using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;

namespace FieldOps.Tests.Integration;

public class ApiFlowTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Password = "Demo123!";

    private static readonly byte[] TinyPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");

    private static readonly DateTime Day = DateTime.UtcNow.Date.AddDays(10);

    private static string Unique(string prefix) => $"{prefix}-{Guid.NewGuid():N}@test.com";

    private async Task<(HttpClient Client, JsonElement Auth)> RegisterOwnerAsync(string company = "Flow Co")
    {
        var client = factory.CreateClient();
        var email = Unique("owner");
        var response = await client.PostAsJsonAsync("/api/auth/register",
            new { companyName = company, firstName = "Olive", lastName = "Owner", email, password = Password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.ReadJsonAsync();
        client.WithToken(auth.Str("accessToken"));
        return (client, auth);
    }

    private async Task<HttpClient> LoginAsync(string email)
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return client.WithToken((await response.ReadJsonAsync()).Str("accessToken"));
    }

    private static async Task<JsonElement> PostOkAsync(HttpClient client, string url, object? body, HttpStatusCode expected = HttpStatusCode.OK)
    {
        var response = await client.PostAsJsonAsync(url, body ?? new { });
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == expected, $"POST {url} -> {(int)response.StatusCode} (expected {(int)expected}): {text}");
        return text.Length == 0 ? default : JsonSerializer.Deserialize<JsonElement>(text, Http.Json);
    }

    [Fact]
    public async Task Full_job_flow_from_registration_to_pdf_report()
    {
        // register -> login -> me
        var email = Unique("owner");
        var anon = factory.CreateClient();
        var reg = await PostOkAsync(anon, "/api/auth/register",
            new { companyName = "Flow Co", firstName = "Olive", lastName = "Owner", email, password = Password });
        Assert.Equal("Flow Co", reg.GetProperty("user").Str("companyName"));
        Assert.Contains("Owner", reg.GetProperty("user").GetProperty("roles").EnumerateArray().Select(r => r.GetString()));

        var owner = await LoginAsync(email);
        var me = await owner.GetFromJsonAsync<JsonElement>("/api/auth/me", Http.Json);
        Assert.Equal(email, me.Str("email"));
        Assert.Equal(JsonValueKind.Null, me.GetProperty("technicianId").ValueKind);

        // customer (a primary location is created from the address)
        var customer = await PostOkAsync(owner, "/api/customers", new
        {
            firstName = "Cathy", lastName = "Customer", companyName = "Cathy's Cafe", email = "cathy@cafe.test",
            phone = "555-0100", address = "1 Coffee Lane", city = "Brewtown", postalCode = "12345"
        }, HttpStatusCode.Created);
        var customerId = customer.Str("id");
        var detail = await owner.GetFromJsonAsync<JsonElement>($"/api/customers/{customerId}", Http.Json);
        var location = detail.GetProperty("locations")[0];
        Assert.True(location.GetProperty("isPrimary").GetBoolean());
        var locationId = location.Str("id");

        // technician user (creates login + profile)
        var techEmail = Unique("tech");
        var technician = await PostOkAsync(owner, "/api/technicians", new
        {
            firstName = "Tom", lastName = "Tech", email = techEmail, password = Password, specialty = "HVAC"
        }, HttpStatusCode.Created);
        var technicianId = technician.Str("id");
        Assert.Equal("HVAC", technician.Str("specialty"));

        // material
        var material = await PostOkAsync(owner, "/api/materials", new
        {
            name = "Copper pipe", sku = "CU-1", unit = "m", quantityOnHand = 20, minimumQuantity = 5, unitCost = 3.5
        }, HttpStatusCode.Created);
        var materialId = material.Str("id");

        // job
        var job = await PostOkAsync(owner, "/api/jobs", new
        {
            customerId, serviceLocationId = locationId, technicianId, title = "Fix cooler", priority = "High",
            description = "Not cooling", estimatedDurationMinutes = 90
        }, HttpStatusCode.Created);
        var jobId = job.Str("id");
        Assert.Equal("JOB-00001", job.Str("jobNumber"));
        Assert.Equal("New", job.Str("status"));
        Assert.Equal("High", job.Str("priority"));
        Assert.Equal("Cathy's Cafe", job.Str("customerName"));
        Assert.Equal("Tom Tech", job.Str("technicianName"));

        // schedule
        var start = Day.AddHours(9);
        var scheduled = await PostOkAsync(owner, $"/api/jobs/{jobId}/schedule",
            new { technicianId, scheduledStart = start, scheduledEnd = start.AddHours(2) });
        Assert.Equal("Scheduled", scheduled.Str("status"));
        Assert.False(scheduled.GetProperty("hasConflict").GetBoolean());

        // technician works the job
        var tech = await LoginAsync(techEmail);
        var techMe = await tech.GetFromJsonAsync<JsonElement>("/api/auth/me", Http.Json);
        Assert.Equal(technicianId, techMe.Str("technicianId"));

        var started = await PostOkAsync(tech, $"/api/jobs/{jobId}/start", null);
        Assert.Equal("InProgress", started.Str("status"));

        var usage = await PostOkAsync(tech, $"/api/jobs/{jobId}/materials", new { materialId, quantity = 4 }, HttpStatusCode.Created);
        Assert.Equal(4m, usage.GetProperty("quantity").GetDecimal());

        var stock = await owner.GetFromJsonAsync<JsonElement>($"/api/materials/{materialId}", Http.Json);
        Assert.Equal(16m, stock.GetProperty("quantityOnHand").GetDecimal());

        // overdrawing stock is refused and leaves inventory untouched
        var overdraw = await tech.PostAsJsonAsync($"/api/jobs/{jobId}/materials", new { materialId, quantity = 500 });
        Assert.Equal(HttpStatusCode.Conflict, overdraw.StatusCode);
        stock = await owner.GetFromJsonAsync<JsonElement>($"/api/materials/{materialId}", Http.Json);
        Assert.Equal(16m, stock.GetProperty("quantityOnHand").GetDecimal());

        await PostOkAsync(tech, $"/api/jobs/{jobId}/notes", new { text = "Replaced the fan motor." }, HttpStatusCode.Created);

        var completed = await PostOkAsync(tech, $"/api/jobs/{jobId}/complete",
            new { workPerformed = "Replaced the fan motor and recharged the system.", laborCost = 150 });
        Assert.Equal("Completed", completed.Str("status"));
        Assert.Equal(150m, completed.GetProperty("laborCost").GetDecimal());
        Assert.Equal(14m, completed.GetProperty("materialsCost").GetDecimal());
        Assert.Single(completed.GetProperty("materialsUsed").EnumerateArray());
        Assert.Single(completed.GetProperty("notes").EnumerateArray());
        Assert.Empty(completed.GetProperty("allowedTransitions").EnumerateArray());

        // PDF report
        var report = await owner.GetAsync($"/api/jobs/{jobId}/report");
        Assert.Equal(HttpStatusCode.OK, report.StatusCode);
        Assert.Equal("application/pdf", report.Content.Headers.ContentType?.MediaType);
        var pdf = await report.Content.ReadAsByteArrayAsync();
        Assert.True(pdf.Length > 500);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(pdf, 0, 4));

        // dashboard reflects the work
        var dashboard = await owner.GetFromJsonAsync<JsonElement>("/api/dashboard", Http.Json);
        Assert.Equal(1, dashboard.GetProperty("jobsCompleted").GetInt32());
        Assert.Equal(164m, dashboard.GetProperty("completedRevenue").GetDecimal());
        Assert.Equal(6, dashboard.GetProperty("jobsByStatus").GetArrayLength());
    }

    [Fact]
    public async Task Scheduling_conflicts_warn_or_block_depending_on_company_setting()
    {
        var (owner, _) = await RegisterOwnerAsync();
        var customer = await PostOkAsync(owner, "/api/customers",
            new { firstName = "A", lastName = "B", address = "1 St" }, HttpStatusCode.Created);
        var locationId = (await owner.GetFromJsonAsync<JsonElement>($"/api/customers/{customer.Str("id")}", Http.Json))
            .GetProperty("locations")[0].Str("id");
        var tech = await PostOkAsync(owner, "/api/technicians",
            new { firstName = "T", lastName = "T", email = Unique("t"), password = Password }, HttpStatusCode.Created);
        var technicianId = tech.Str("id");

        async Task<string> NewJobAsync(string title) =>
            (await PostOkAsync(owner, "/api/jobs",
                new { customerId = customer.Str("id"), serviceLocationId = locationId, title }, HttpStatusCode.Created)).Str("id");

        var first = await NewJobAsync("first");
        var second = await NewJobAsync("second");
        var third = await NewJobAsync("third");
        var start = Day.AddHours(9);

        await PostOkAsync(owner, $"/api/jobs/{first}/schedule", new { technicianId, scheduledStart = start, scheduledEnd = start.AddHours(2) });

        // default: conflicts allowed -> 200 with warnings
        var warned = await PostOkAsync(owner, $"/api/jobs/{second}/schedule",
            new { technicianId, scheduledStart = start.AddHours(1), scheduledEnd = start.AddHours(3) });
        Assert.True(warned.GetProperty("hasConflict").GetBoolean());
        Assert.Equal(1, warned.GetProperty("conflicts").GetArrayLength());
        Assert.Equal(1, warned.GetProperty("warnings").GetArrayLength());
        Assert.Equal("Scheduled", warned.Str("status"));

        // forbid conflicts
        var company = await owner.GetFromJsonAsync<JsonElement>("/api/company", Http.Json);
        var update = await owner.PutAsJsonAsync("/api/company", new { name = company.Str("name"), allowSchedulingConflicts = false });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var blocked = await owner.PostAsJsonAsync($"/api/jobs/{third}/schedule",
            new { technicianId, scheduledStart = start.AddHours(1), scheduledEnd = start.AddHours(2), force = true });
        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
        var body = await blocked.ReadJsonAsync();
        Assert.Equal(409, body.GetProperty("status").GetInt32());
        Assert.True(body.GetProperty("conflicts").GetArrayLength() >= 1);

        var unchanged = await owner.GetFromJsonAsync<JsonElement>($"/api/jobs/{third}", Http.Json);
        Assert.Equal("New", unchanged.Str("status"));

        // a free slot is fine, and it shows up in the schedule feed
        var okSlot = await PostOkAsync(owner, $"/api/jobs/{third}/schedule",
            new { technicianId, scheduledStart = start.AddHours(3), scheduledEnd = start.AddHours(4) });
        Assert.False(okSlot.GetProperty("hasConflict").GetBoolean());

        var feed = await owner.GetFromJsonAsync<JsonElement>(
            $"/api/schedule?from={Uri.EscapeDataString(start.AddHours(-1).ToString("o"))}&to={Uri.EscapeDataString(start.AddHours(8).ToString("o"))}&technicianId={technicianId}",
            Http.Json);
        Assert.Equal(3, feed.GetArrayLength());
    }

    [Fact]
    public async Task Role_and_assignment_rules_are_enforced()
    {
        var (owner, _) = await RegisterOwnerAsync();
        var customer = await PostOkAsync(owner, "/api/customers",
            new { firstName = "A", lastName = "B", address = "1 St" }, HttpStatusCode.Created);
        var locationId = (await owner.GetFromJsonAsync<JsonElement>($"/api/customers/{customer.Str("id")}", Http.Json))
            .GetProperty("locations")[0].Str("id");

        var techEmail = Unique("tech");
        await PostOkAsync(owner, "/api/users",
            new { firstName = "Tia", lastName = "Tech", email = techEmail, password = Password, role = "Technician", specialty = "Plumbing" },
            HttpStatusCode.Created);
        var dispatcherEmail = Unique("disp");
        await PostOkAsync(owner, "/api/users",
            new { firstName = "Dan", lastName = "Disp", email = dispatcherEmail, password = Password, role = "Dispatcher" },
            HttpStatusCode.Created);

        var tech = await LoginAsync(techEmail);
        var dispatcher = await LoginAsync(dispatcherEmail);

        var job = await PostOkAsync(owner, "/api/jobs",
            new { customerId = customer.Str("id"), serviceLocationId = locationId, title = "Unassigned job" }, HttpStatusCode.Created);

        // users list shows the technician with a technicianId
        var users = await owner.GetFromJsonAsync<JsonElement>("/api/users", Http.Json);
        var techUser = users.EnumerateArray().Single(u => u.Str("email") == techEmail);
        Assert.NotEqual(JsonValueKind.Null, techUser.GetProperty("technicianId").ValueKind);

        // technician: may not list company-wide customers; may not create/alter or touch unassigned jobs
        Assert.Equal(HttpStatusCode.Forbidden, (await tech.GetAsync("/api/customers")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await tech.PostAsJsonAsync("/api/customers", new { firstName = "x", lastName = "y" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await tech.PostAsJsonAsync($"/api/jobs/{job.Str("id")}/start", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await tech.PostAsJsonAsync($"/api/jobs/{job.Str("id")}/notes", new { text = "sneaky" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await tech.GetAsync($"/api/jobs/{job.Str("id")}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await tech.GetAsync("/api/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await tech.PutAsJsonAsync("/api/company", new { name = "Hacked" })).StatusCode);

        // dispatcher: manages jobs, but not users/company
        Assert.Equal(HttpStatusCode.Created, (await dispatcher.PostAsJsonAsync("/api/customers", new { firstName = "x", lastName = "y" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await dispatcher.GetAsync("/api/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await dispatcher.PutAsJsonAsync("/api/company", new { name = "Nope" })).StatusCode);

        // invalid transition surfaces as 409 in the error format
        var bad = await owner.PostAsJsonAsync($"/api/jobs/{job.Str("id")}/complete", new { workPerformed = "never started" });
        Assert.Equal(HttpStatusCode.Conflict, bad.StatusCode);
        Assert.Equal(409, (await bad.ReadJsonAsync()).GetProperty("status").GetInt32());
    }

    [Fact]
    public async Task Tenants_are_isolated_and_anonymous_access_is_rejected()
    {
        var (ownerA, _) = await RegisterOwnerAsync("Company A");
        var (ownerB, _) = await RegisterOwnerAsync("Company B");

        var customer = await PostOkAsync(ownerA, "/api/customers", new { firstName = "Secret", lastName = "Customer" }, HttpStatusCode.Created);
        var id = customer.Str("id");

        Assert.Equal(HttpStatusCode.NotFound, (await ownerB.GetAsync($"/api/customers/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ownerB.PutAsJsonAsync($"/api/customers/{id}", new { firstName = "x", lastName = "y" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ownerB.DeleteAsync($"/api/customers/{id}")).StatusCode);

        var listB = await ownerB.GetFromJsonAsync<JsonElement>("/api/customers", Http.Json);
        Assert.Equal(0, listB.GetProperty("totalCount").GetInt32());
        var search = await ownerB.GetFromJsonAsync<JsonElement>("/api/search?q=Secret", Http.Json);
        Assert.Equal(0, search.GetProperty("customers").GetArrayLength());

        var listA = await ownerA.GetFromJsonAsync<JsonElement>("/api/customers?search=secret", Http.Json);
        Assert.Equal(1, listA.GetProperty("totalCount").GetInt32());

        var anonymous = factory.CreateClient();
        var response = await anonymous.GetAsync("/api/customers");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(401, (await response.ReadJsonAsync()).GetProperty("status").GetInt32());
    }

    [Fact]
    public async Task Validation_errors_use_the_standard_error_format()
    {
        var (owner, _) = await RegisterOwnerAsync();

        var response = await owner.PostAsJsonAsync("/api/customers", new { firstName = "", lastName = "Doe", email = "nope" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.ReadJsonAsync();
        Assert.Equal(400, body.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(body.Str("message")));
        var errors = body.GetProperty("errors");
        Assert.True(errors.TryGetProperty("firstName", out var fn) && fn.GetArrayLength() > 0);
        Assert.True(errors.TryGetProperty("email", out _));

        var weak = await factory.CreateClient().PostAsJsonAsync("/api/auth/register",
            new { companyName = "X Co", firstName = "A", lastName = "B", email = Unique("weak"), password = "short" });
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
        Assert.True((await weak.ReadJsonAsync()).GetProperty("errors").TryGetProperty("password", out _));

        var missing = await owner.GetAsync($"/api/jobs/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal(404, (await missing.ReadJsonAsync()).GetProperty("status").GetInt32());
    }

    [Fact]
    public async Task Auth_refresh_rotates_tokens_and_logout_revokes()
    {
        var email = Unique("owner");
        var anon = factory.CreateClient();
        await PostOkAsync(anon, "/api/auth/register",
            new { companyName = "Auth Co", firstName = "A", lastName = "B", email, password = Password });

        // wrong password
        var wrong = await anon.PostAsJsonAsync("/api/auth/login", new { email, password = "Wrong123!" });
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);

        var login = await PostOkAsync(anon, "/api/auth/login", new { email, password = Password });
        var refresh1 = login.Str("refreshToken");

        var refreshed = await PostOkAsync(anon, "/api/auth/refresh", new { refreshToken = refresh1 });
        var refresh2 = refreshed.Str("refreshToken");
        Assert.NotEqual(refresh1, refresh2);
        Assert.False(string.IsNullOrWhiteSpace(refreshed.Str("accessToken")));

        // old token is single-use; replaying it is rejected (and burns the token family)
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = refresh1 })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = refresh2 })).StatusCode);

        var again = await PostOkAsync(anon, "/api/auth/login", new { email, password = Password });
        var logout = await anon.PostAsJsonAsync("/api/auth/logout", new { refreshToken = again.Str("refreshToken") });
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anon.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = again.Str("refreshToken") })).StatusCode);

        // duplicate registration
        var dup = await anon.PostAsJsonAsync("/api/auth/register",
            new { companyName = "Auth Co 2", firstName = "A", lastName = "B", email, password = Password });
        Assert.Equal(HttpStatusCode.Conflict, dup.StatusCode);
    }

    [Fact]
    public async Task Photos_are_validated_stored_and_downloadable()
    {
        var (owner, _) = await RegisterOwnerAsync();
        var customer = await PostOkAsync(owner, "/api/customers",
            new { firstName = "A", lastName = "B", address = "1 St" }, HttpStatusCode.Created);
        var locationId = (await owner.GetFromJsonAsync<JsonElement>($"/api/customers/{customer.Str("id")}", Http.Json))
            .GetProperty("locations")[0].Str("id");
        var job = await PostOkAsync(owner, "/api/jobs",
            new { customerId = customer.Str("id"), serviceLocationId = locationId, title = "Photo job" }, HttpStatusCode.Created);
        var jobId = job.Str("id");

        HttpContent Form(byte[] bytes, string fileName, string contentType)
        {
            var file = new ByteArrayContent(bytes);
            file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            return new MultipartFormDataContent { { file, "file", fileName }, { new StringContent("Before"), "caption" } };
        }

        var ok = await owner.PostAsync($"/api/jobs/{jobId}/photos", Form(TinyPng, "before.png", "image/png"));
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
        var photo = await ok.ReadJsonAsync();
        Assert.Equal("Before", photo.Str("caption"));

        var download = await owner.GetAsync($"/api/jobs/{jobId}/photos/{photo.Str("id")}");
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal("image/png", download.Content.Headers.ContentType?.MediaType);
        Assert.Equal(TinyPng, await download.Content.ReadAsByteArrayAsync());

        // disallowed MIME type / extension mismatch / fake content / too large
        Assert.Equal(HttpStatusCode.BadRequest,
            (await owner.PostAsync($"/api/jobs/{jobId}/photos", Form("hello"u8.ToArray(), "notes.txt", "text/plain"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await owner.PostAsync($"/api/jobs/{jobId}/photos", Form(TinyPng, "evil.exe", "image/png"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await owner.PostAsync($"/api/jobs/{jobId}/photos", Form("<html>not an image</html>"u8.ToArray(), "fake.png", "image/png"))).StatusCode);
        var big = new byte[1_100_000];
        TinyPng.CopyTo(big, 0);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await owner.PostAsync($"/api/jobs/{jobId}/photos", Form(big, "big.png", "image/png"))).StatusCode);

        var detail = await owner.GetFromJsonAsync<JsonElement>($"/api/jobs/{jobId}", Http.Json);
        Assert.Equal(1, detail.GetProperty("photos").GetArrayLength());
    }

    [Fact]
    public async Task Equipment_reminders_and_maintenance_jobs_work()
    {
        var (owner, _) = await RegisterOwnerAsync();
        var customer = await PostOkAsync(owner, "/api/customers",
            new { firstName = "A", lastName = "B", address = "1 St" }, HttpStatusCode.Created);
        var customerId = customer.Str("id");

        string Iso(int days) => DateTime.UtcNow.AddDays(days).ToString("o");
        async Task<string> NewEquipmentAsync(string name, int dueInDays) =>
            (await PostOkAsync(owner, "/api/equipment",
                new { customerId, name, nextMaintenanceDate = Iso(dueInDays) }, HttpStatusCode.Created)).Str("id");

        var overdueId = await NewEquipmentAsync("Overdue unit", -5);
        await NewEquipmentAsync("Soon unit", 3);
        await NewEquipmentAsync("Later unit", 20);
        await NewEquipmentAsync("Far unit", 200);

        var reminders = await owner.GetFromJsonAsync<JsonElement>("/api/equipment/reminders", Http.Json);
        Assert.Equal(1, reminders.GetProperty("overdue").GetArrayLength());
        Assert.Equal(1, reminders.GetProperty("dueThisWeek").GetArrayLength());
        Assert.Equal(1, reminders.GetProperty("dueThisMonth").GetArrayLength());

        var list = await owner.GetFromJsonAsync<JsonElement>($"/api/equipment?customerId={customerId}&pageSize=2", Http.Json);
        Assert.Equal(4, list.GetProperty("totalCount").GetInt32());
        Assert.Equal(2, list.GetProperty("totalPages").GetInt32());

        var job = await PostOkAsync(owner, $"/api/equipment/{overdueId}/maintenance-job", null, HttpStatusCode.Created);
        Assert.Equal(overdueId, job.Str("equipmentId"));
        Assert.Contains("Overdue unit", job.Str("title"));

        var jobs = await owner.GetFromJsonAsync<JsonElement>($"/api/jobs?equipmentId={overdueId}", Http.Json);
        Assert.Equal(1, jobs.GetProperty("totalCount").GetInt32());
    }

    [Fact]
    public async Task Demo_seed_data_supports_the_documented_demo_logins()
    {
        using (var scope = factory.Services.CreateScope())
        {
            var seeder = scope.ServiceProvider.GetRequiredService<FieldOps.Infrastructure.Seeding.DataSeeder>();
            await seeder.SeedAsync();
            await seeder.SeedAsync(); // idempotent
        }

        var admin = await LoginAsync("admin@acme.example");
        var dashboard = await admin.GetFromJsonAsync<JsonElement>("/api/dashboard", Http.Json);
        Assert.True(dashboard.GetProperty("customersCount").GetInt32() >= 6);
        Assert.True(dashboard.GetProperty("jobsInProgress").GetInt32() >= 1);
        Assert.True(dashboard.GetProperty("jobsOverdue").GetInt32() >= 1);
        Assert.Equal(3, dashboard.GetProperty("technicianWorkload").GetArrayLength());
        Assert.Equal(14, dashboard.GetProperty("jobsOverTime").GetArrayLength());

        var reminders = await admin.GetFromJsonAsync<JsonElement>("/api/equipment/reminders", Http.Json);
        Assert.True(reminders.GetProperty("overdue").GetArrayLength() >= 1);

        var lowStock = await admin.GetFromJsonAsync<JsonElement>("/api/materials?lowStock=true", Http.Json);
        Assert.Equal(2, lowStock.GetProperty("totalCount").GetInt32());

        var dispatcher = await LoginAsync("dispatcher@acme.example");
        Assert.Equal(HttpStatusCode.OK, (await dispatcher.GetAsync("/api/jobs?pageSize=50")).StatusCode);

        var technician = await LoginAsync("technician@acme.example");
        var me = await technician.GetFromJsonAsync<JsonElement>("/api/auth/me", Http.Json);
        Assert.Equal("Technician", me.GetProperty("roles")[0].GetString());
        var mine = await technician.GetFromJsonAsync<JsonElement>(
            $"/api/jobs?technicianId={me.Str("technicianId")}&pageSize=50", Http.Json);
        Assert.True(mine.GetProperty("totalCount").GetInt32() >= 4);
    }

    [Fact]
    public async Task Materials_support_search_low_stock_filter_and_pagination()
    {
        var (owner, _) = await RegisterOwnerAsync();
        await PostOkAsync(owner, "/api/materials", new { name = "Bolts", quantityOnHand = 2, minimumQuantity = 10, unitCost = 0.1 }, HttpStatusCode.Created);
        await PostOkAsync(owner, "/api/materials", new { name = "Nuts", quantityOnHand = 100, minimumQuantity = 10, unitCost = 0.1 }, HttpStatusCode.Created);

        var low = await owner.GetFromJsonAsync<JsonElement>("/api/materials?lowStock=true", Http.Json);
        Assert.Equal(1, low.GetProperty("totalCount").GetInt32());
        Assert.Equal("Bolts", low.GetProperty("items")[0].Str("name"));
        Assert.True(low.GetProperty("items")[0].GetProperty("isLowStock").GetBoolean());

        var search = await owner.GetFromJsonAsync<JsonElement>("/api/materials?search=nut&page=1&pageSize=10", Http.Json);
        Assert.Equal(1, search.GetProperty("totalCount").GetInt32());
        Assert.Equal(1, search.GetProperty("totalPages").GetInt32());

        var dashboard = await owner.GetFromJsonAsync<JsonElement>("/api/dashboard", Http.Json);
        Assert.Equal(1, dashboard.GetProperty("lowStockMaterials").GetInt32());
    }
}
