using FieldOps.Application.Common;
using FieldOps.Application.DTOs;

namespace FieldOps.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<AuthResponse> RefreshAsync(RefreshRequest request, CancellationToken ct = default);
    Task LogoutAsync(LogoutRequest request, CancellationToken ct = default);
    Task<UserDto> GetCurrentUserAsync(CancellationToken ct = default);
}

public interface ICustomerService
{
    Task<PagedResult<CustomerDto>> ListAsync(CustomerQuery query, CancellationToken ct = default);
    Task<CustomerDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<CustomerDto> CreateAsync(SaveCustomerRequest request, CancellationToken ct = default);
    Task<CustomerDto> UpdateAsync(Guid id, SaveCustomerRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<ServiceLocationDto>> ListLocationsAsync(Guid customerId, CancellationToken ct = default);
    Task<ServiceLocationDto> AddLocationAsync(Guid customerId, SaveServiceLocationRequest request, CancellationToken ct = default);
    Task<ServiceLocationDto> UpdateLocationAsync(Guid customerId, Guid locationId, SaveServiceLocationRequest request, CancellationToken ct = default);
    Task DeleteLocationAsync(Guid customerId, Guid locationId, CancellationToken ct = default);
}

public interface ITechnicianService
{
    Task<PagedResult<TechnicianDto>> ListAsync(TechnicianQuery query, CancellationToken ct = default);
    Task<TechnicianDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<TechnicianDto> CreateAsync(CreateTechnicianRequest request, CancellationToken ct = default);
    Task<TechnicianDto> UpdateAsync(Guid id, UpdateTechnicianRequest request, CancellationToken ct = default);
}

public interface IJobService
{
    Task<PagedResult<JobDto>> ListAsync(JobQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<JobDto>> GetScheduleAsync(ScheduleQuery query, CancellationToken ct = default);
    Task<JobDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<JobDto> CreateAsync(SaveJobRequest request, CancellationToken ct = default);
    Task<JobDto> UpdateAsync(Guid id, SaveJobRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    Task<ScheduleJobResponse> ScheduleAsync(Guid id, ScheduleJobRequest request, CancellationToken ct = default);
    Task<JobDto> StartAsync(Guid id, CancellationToken ct = default);
    Task<JobDto> CompleteAsync(Guid id, CompleteJobRequest request, CancellationToken ct = default);
    Task<JobDto> HoldAsync(Guid id, ReasonRequest? request, CancellationToken ct = default);
    Task<JobDto> CancelAsync(Guid id, ReasonRequest? request, CancellationToken ct = default);

    Task<JobNoteDto> AddNoteAsync(Guid id, AddNoteRequest request, CancellationToken ct = default);
    Task<JobPhotoDto> AddPhotoAsync(Guid id, Stream content, string fileName, string contentType, long length, string? caption, CancellationToken ct = default);
    Task<PhotoContent> GetPhotoAsync(Guid jobId, Guid photoId, CancellationToken ct = default);
}

public interface IMaterialService
{
    Task<PagedResult<MaterialDto>> ListAsync(MaterialQuery query, CancellationToken ct = default);
    Task<MaterialDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<MaterialDto> CreateAsync(SaveMaterialRequest request, CancellationToken ct = default);
    Task<MaterialDto> UpdateAsync(Guid id, SaveMaterialRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    /// <summary>Records material usage on a job and deducts inventory atomically (transaction + optimistic concurrency retry).</summary>
    Task<JobMaterialDto> RecordJobUsageAsync(Guid jobId, AddJobMaterialRequest request, CancellationToken ct = default);
}

public interface IEquipmentService
{
    Task<PagedResult<EquipmentDto>> ListAsync(EquipmentQuery query, CancellationToken ct = default);
    Task<EquipmentDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<EquipmentDto> CreateAsync(SaveEquipmentRequest request, CancellationToken ct = default);
    Task<EquipmentDto> UpdateAsync(Guid id, SaveEquipmentRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<MaintenanceReminderSummaryDto> GetRemindersAsync(CancellationToken ct = default);
    Task<JobDto> CreateMaintenanceJobAsync(Guid equipmentId, CancellationToken ct = default);
}

public interface IDashboardService
{
    Task<DashboardDto> GetAsync(CancellationToken ct = default);
}

public interface ISearchService
{
    Task<SearchResultsDto> SearchAsync(string? query, CancellationToken ct = default);
}

public interface ICompanyService
{
    Task<CompanyDto> GetAsync(CancellationToken ct = default);
    Task<CompanyDto> UpdateAsync(UpdateCompanyRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<UserDto>> ListUsersAsync(CancellationToken ct = default);
    Task<UserDto> CreateUserAsync(CreateUserRequest request, CancellationToken ct = default);
}

public interface IReportService
{
    /// <summary>Renders a printable PDF work-order report for a job.</summary>
    byte[] GenerateJobReport(JobDto job, CompanyDto company);
}
