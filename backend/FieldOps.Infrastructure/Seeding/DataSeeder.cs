using FieldOps.Domain.Entities;
using FieldOps.Domain.Enums;
using FieldOps.Infrastructure.Auth;
using FieldOps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FieldOps.Infrastructure.Seeding;

/// <summary>Development-only demo data: "Acme Services" with owner / dispatcher / technician demo users.</summary>
public class DataSeeder(AppDbContext db, IdentityProvisioner provisioner, ILogger<DataSeeder> logger)
{
    public const string CompanyName = "Acme Services";
    public const string DemoPassword = "Demo123!";

    public async Task SeedAsync(CancellationToken ct = default)
    {
        if (await db.Companies.AnyAsync(c => c.Name == CompanyName, ct))
        {
            logger.LogInformation("Seed data already present - skipping.");
            return;
        }

        var today = DateTime.UtcNow.Date;
        DateTime At(int dayOffset, int hour, int minute = 0) => today.AddDays(dayOffset).AddHours(hour).AddMinutes(minute);

        var company = new Company
        {
            Name = CompanyName,
            Email = "demo@acme.example",
            Phone = "+1 555 010 0000",
            Address = "100 Industrial Way",
            City = "Springfield",
            PostalCode = "12345",
            Website = "https://acme.example",
            AllowSchedulingConflicts = true
        };
        db.Companies.Add(company);
        await db.SaveChangesAsync(ct);
        var cid = company.Id;

        // ---- users (fictional demo accounts only) ---------------------------
        var admin = await provisioner.CreateUserAsync(cid, "Alex", "Admin", "admin@acme.example", DemoPassword, AppRoles.Owner);
        var dispatcher = await provisioner.CreateUserAsync(cid, "Dana", "Dispatcher", "dispatcher@acme.example", DemoPassword, AppRoles.Dispatcher);
        var techUser1 = await provisioner.CreateUserAsync(cid, "Tom", "Technician", "technician@acme.example", DemoPassword, AppRoles.Technician, "+1 555 010 0101");
        var techUser2 = await provisioner.CreateUserAsync(cid, "Sara", "Sparks", "sara.sparks@acme.example", DemoPassword, AppRoles.Technician, "+1 555 010 0102");
        var techUser3 = await provisioner.CreateUserAsync(cid, "Raj", "Rivers", "raj.rivers@acme.example", DemoPassword, AppRoles.Technician, "+1 555 010 0103");

        var tech1 = new Technician { CompanyId = cid, UserId = techUser1.Id, Specialty = "HVAC" };
        var tech2 = new Technician { CompanyId = cid, UserId = techUser2.Id, Specialty = "Electrical" };
        var tech3 = new Technician { CompanyId = cid, UserId = techUser3.Id, Specialty = "Plumbing" };
        db.Technicians.AddRange(tech1, tech2, tech3);

        // ---- customers + locations -------------------------------------------
        Customer NewCustomer(string first, string last, string? company, string email, string phone, string address, string city, string postal, string? notes = null) =>
            new()
            {
                CompanyId = cid, FirstName = first, LastName = last, CompanyName = company, Email = email, Phone = phone,
                Address = address, City = city, PostalCode = postal, Notes = notes
            };

        var customers = new[]
        {
            NewCustomer("Maria", "Papadopoulou", "Papadopoulou Bakery", "maria@example.com", "+1 555 020 0001", "12 Baker Street", "Springfield", "12345", "Open 6am - 3pm. Use rear entrance."),
            NewCustomer("John", "Smith", null, "john.smith@example.com", "+1 555 020 0002", "48 Maple Avenue", "Springfield", "12346"),
            NewCustomer("Linda", "Nguyen", "Nguyen Dental Clinic", "linda.nguyen@example.com", "+1 555 020 0003", "7 Health Plaza", "Shelbyville", "22001"),
            NewCustomer("Omar", "Haddad", "Haddad Hotel & Suites", "omar.haddad@example.com", "+1 555 020 0004", "1 Grand Boulevard", "Springfield", "12350", "Key contact: front desk."),
            NewCustomer("Emily", "Stone", null, "emily.stone@example.com", "+1 555 020 0005", "205 Oak Lane", "Capital City", "33010"),
            NewCustomer("George", "Kostas", "Kostas Market", "george.kostas@example.com", "+1 555 020 0006", "90 Market Square", "Shelbyville", "22005")
        };
        db.Customers.AddRange(customers);

        var locations = new List<ServiceLocation>();
        foreach (var c in customers)
        {
            locations.Add(new ServiceLocation
            {
                CompanyId = cid, CustomerId = c.Id, Name = c.CompanyName is null ? "Home" : "Main site",
                Address = c.Address!, City = c.City, PostalCode = c.PostalCode, IsPrimary = true
            });
        }
        locations.Add(new ServiceLocation
        {
            CompanyId = cid, CustomerId = customers[3].Id, Name = "Annex building", Address = "3 Grand Boulevard",
            City = "Springfield", PostalCode = "12350", IsPrimary = false, Notes = "Boiler room in basement."
        });
        locations.Add(new ServiceLocation
        {
            CompanyId = cid, CustomerId = customers[5].Id, Name = "Warehouse", Address = "14 Dock Road",
            City = "Shelbyville", PostalCode = "22009", IsPrimary = false
        });
        db.ServiceLocations.AddRange(locations);
        ServiceLocation Loc(int customerIndex, int nth = 0) => locations.Where(l => l.CustomerId == customers[customerIndex].Id).ElementAt(nth);

        // ---- materials --------------------------------------------------------
        Material NewMaterial(string name, string sku, string unit, decimal qty, decimal min, decimal cost) =>
            new() { CompanyId = cid, Name = name, Sku = sku, Unit = unit, QuantityOnHand = qty, MinimumQuantity = min, UnitCost = cost };

        var copperPipe = NewMaterial("Copper pipe 1/2\"", "CU-050", "m", 120, 30, 6.50m);
        var pvcFitting = NewMaterial("PVC fitting 40mm", "PVC-040", "ea", 85, 20, 1.80m);
        var airFilter = NewMaterial("Air filter 20x25", "AF-2025", "ea", 14, 10, 12.00m);
        var refrigerant = NewMaterial("Refrigerant R410A", "RF-410A", "kg", 4, 5, 38.00m);   // low stock
        var thermostat = NewMaterial("Smart thermostat", "TH-100", "ea", 9, 3, 89.00m);
        var breaker = NewMaterial("Circuit breaker 20A", "CB-020", "ea", 32, 10, 9.50m);
        var wire = NewMaterial("Electrical wire 2.5mm", "EW-025", "m", 18, 50, 0.95m);        // low stock
        var sealant = NewMaterial("Silicone sealant", "SS-001", "ea", 40, 8, 4.25m);
        db.Materials.AddRange(copperPipe, pvcFitting, airFilter, refrigerant, thermostat, breaker, wire, sealant);

        // ---- equipment --------------------------------------------------------
        Equipment NewEquipment(int customerIndex, int locationNth, string name, string type, string maker, string model, string serial,
            DateTime? lastMaintenance, DateTime? nextMaintenance) =>
            new()
            {
                CompanyId = cid, CustomerId = customers[customerIndex].Id, ServiceLocationId = Loc(customerIndex, locationNth).Id,
                Name = name, Type = type, Manufacturer = maker, Model = model, SerialNumber = serial,
                InstallationDate = today.AddYears(-3), WarrantyExpiration = today.AddYears(2),
                LastMaintenanceDate = lastMaintenance, NextMaintenanceDate = nextMaintenance
            };

        var eqOven = NewEquipment(0, 0, "Rooftop AC unit", "HVAC", "Carrier", "50XC-12", "CAR-77821", today.AddDays(-190), today.AddDays(-10));      // overdue
        var eqBoiler = NewEquipment(3, 1, "Hot water boiler", "Boiler", "Viessmann", "Vitodens 200", "VIE-33012", today.AddDays(-360), today.AddDays(3)); // this week
        var eqChiller = NewEquipment(3, 0, "Lobby chiller", "HVAC", "Trane", "CGAM-60", "TRN-90417", today.AddDays(-160), today.AddDays(20));            // this month
        var eqFurnace = NewEquipment(1, 0, "Gas furnace", "Furnace", "Lennox", "SL280V", "LEN-20118", today.AddDays(-100), today.AddDays(265));
        var eqCold = NewEquipment(5, 0, "Walk-in cooler", "Refrigeration", "Hussmann", "WIC-8", "HUS-55120", today.AddDays(-40), today.AddDays(-2));        // overdue
        var eqPanel = NewEquipment(2, 0, "Main electrical panel", "Electrical", "Schneider", "QO-200", "SCH-11893", today.AddDays(-300), today.AddDays(28));
        db.Equipment.AddRange(eqOven, eqBoiler, eqChiller, eqFurnace, eqCold, eqPanel);

        // ---- jobs ---------------------------------------------------------------
        var sequence = company.NextJobSequence;
        var jobs = new List<Job>();
        var notes = new List<JobNote>();
        var usages = new List<JobMaterial>();

        Job AddJob(string title, int customerIndex, int locationNth, Technician? tech, JobStatus status, JobPriority priority,
            DateTime? start, int? minutes, string? description = null, Equipment? equipment = null, string? work = null, decimal? labor = null,
            bool started = false)
        {
            var job = new Job
            {
                CompanyId = cid,
                JobNumber = $"JOB-{sequence++:D5}",
                CustomerId = customers[customerIndex].Id,
                ServiceLocationId = Loc(customerIndex, locationNth).Id,
                TechnicianId = tech?.Id,
                EquipmentId = equipment?.Id,
                Title = title,
                Description = description,
                Priority = priority,
                Status = status,
                ScheduledStart = start,
                ScheduledEnd = start.HasValue && minutes.HasValue ? start.Value.AddMinutes(minutes.Value) : null,
                EstimatedDurationMinutes = minutes,
                CreatedAt = (start ?? DateTime.UtcNow).AddDays(-3),
                UpdatedAt = DateTime.UtcNow
            };

            if (started || status is JobStatus.InProgress or JobStatus.Completed)
                job.ActualStart = start;
            if (status == JobStatus.Completed)
            {
                job.ActualEnd = job.ScheduledEnd;
                job.WorkPerformed = work ?? "Completed the requested work and tested the system.";
                job.LaborCost = labor ?? 120m;
            }

            jobs.Add(job);
            return job;
        }

        void Use(Job job, Material material, decimal qty)
        {
            usages.Add(new JobMaterial
            {
                CompanyId = cid, JobId = job.Id, MaterialId = material.Id, Quantity = qty, UnitCost = material.UnitCost,
                RecordedById = dispatcher.Id, CreatedAt = job.ActualEnd ?? DateTime.UtcNow
            });
            job.MaterialsCost = (job.MaterialsCost ?? 0) + Math.Round(qty * material.UnitCost, 2);
        }

        // Completed (past)
        var j1 = AddJob("Replace air filters", 0, 0, tech1, JobStatus.Completed, JobPriority.Normal, At(-12, 9), 60, "Quarterly filter replacement.", eqOven, "Replaced two filters and cleaned the housing.", 90m);
        Use(j1, airFilter, 2);
        var j2 = AddJob("Fix leaking kitchen tap", 1, 0, tech3, JobStatus.Completed, JobPriority.Low, At(-9, 10), 90, "Dripping mixer tap.", null, "Replaced cartridge and resealed base.", 75m);
        Use(j2, sealant, 1);
        var j3 = AddJob("Install smart thermostat", 4, 0, tech1, JobStatus.Completed, JobPriority.Normal, At(-6, 13), 120, "Customer supplied wifi details.", null, "Installed and configured thermostat; showed customer the app.", 140m);
        Use(j3, thermostat, 1);
        var j4 = AddJob("Replace tripped breaker", 2, 0, tech2, JobStatus.Completed, JobPriority.High, At(-4, 8), 60, "Surgery room circuit keeps tripping.", eqPanel, "Replaced faulty 20A breaker and checked load.", 110m);
        Use(j4, breaker, 1);
        Use(j4, wire, 12);
        var j5 = AddJob("Annual boiler inspection", 3, 1, tech3, JobStatus.Completed, JobPriority.Normal, At(-2, 9), 150, null, eqBoiler, "Inspection passed; flushed system.", 210m);
        Use(j5, copperPipe, 3);

        // In progress today
        var j6 = AddJob("Walk-in cooler not cooling", 5, 0, tech1, JobStatus.InProgress, JobPriority.Urgent, At(0, 8), 180, "Temperature rising above 8C.", eqCold, started: true);
        notes.Add(new JobNote { CompanyId = cid, Job = j6, AuthorId = techUser1.Id, Text = "Compressor is running but evaporator fan seems dead. Ordering a replacement fan motor." });
        var j7 = AddJob("Rewire kitchen lighting", 0, 0, tech2, JobStatus.InProgress, JobPriority.Normal, At(0, 10), 240, started: true);

        // Scheduled soon
        AddJob("Boiler pressure check", 3, 1, tech3, JobStatus.Scheduled, JobPriority.High, At(0, 14), 90, "Pressure dropping overnight.", eqBoiler);
        AddJob("Install ceiling fans", 1, 0, tech2, JobStatus.Scheduled, JobPriority.Low, At(1, 9), 180);
        AddJob("Chiller seasonal service", 3, 0, tech1, JobStatus.Scheduled, JobPriority.Normal, At(2, 9), 240, "Seasonal service.", eqChiller);
        AddJob("Replace water heater", 4, 0, tech3, JobStatus.Scheduled, JobPriority.High, At(3, 8), 300, "50 gal unit supplied by customer.");
        AddJob("Panel safety inspection", 2, 0, tech2, JobStatus.Scheduled, JobPriority.Normal, At(5, 11), 90, null, eqPanel);

        // Overdue (scheduled in the past, still open)
        AddJob("Replace thermostat wiring", 1, 0, tech1, JobStatus.Scheduled, JobPriority.Normal, At(-1, 15), 60, "Customer reported intermittent heating.", eqFurnace);

        // New / unassigned, on hold, cancelled
        AddJob("Quote: warehouse lighting upgrade", 5, 1, null, JobStatus.New, JobPriority.Low, null, 120, "Site visit to quote LED upgrade.");
        AddJob("Investigate low water pressure", 4, 0, null, JobStatus.New, JobPriority.Normal, null, 60);
        AddJob("Replace compressor", 5, 0, tech1, JobStatus.OnHold, JobPriority.High, At(1, 13), 240, "Waiting for parts delivery.", eqCold);
        AddJob("Duct cleaning", 0, 0, tech1, JobStatus.Cancelled, JobPriority.Low, At(-5, 9), 120, "Customer postponed indefinitely.");

        company.NextJobSequence = sequence;
        db.Jobs.AddRange(jobs);
        db.JobNotes.AddRange(notes);
        db.JobMaterials.AddRange(usages);

        await db.SaveChangesAsync(ct);
        // Do not log passwords — credentials are documented in README for local demo use only.
        logger.LogInformation(
            "Seeded fictional demo data for {Company}. Sign in with admin@acme.example, dispatcher@acme.example, or technician@acme.example (see README).",
            CompanyName);
    }
}
