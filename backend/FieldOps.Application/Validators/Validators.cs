using FieldOps.Application.DTOs;
using FieldOps.Domain.Enums;
using FluentValidation;

namespace FieldOps.Application.Validators;

internal static class Rules
{
    public static IRuleBuilderOptions<T, string?> StrongPassword<T>(this IRuleBuilder<T, string?> rule) =>
        rule.NotEmpty().WithMessage("Password is required.")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters.")
            .MaximumLength(128)
            .Matches("[A-Z]").WithMessage("Password must contain an uppercase letter.")
            .Matches("[a-z]").WithMessage("Password must contain a lowercase letter.")
            .Matches("[0-9]").WithMessage("Password must contain a digit.");
}

public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.CompanyName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Password).StrongPassword();
    }
}

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class RefreshRequestValidator : AbstractValidator<RefreshRequest>
{
    public RefreshRequestValidator()
    {
        RuleFor(x => x.RefreshToken).NotEmpty();
    }
}

public class SaveCustomerRequestValidator : AbstractValidator<SaveCustomerRequest>
{
    public SaveCustomerRequestValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.CompanyName).MaximumLength(150);
        RuleFor(x => x.Email).EmailAddress().MaximumLength(256).When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Phone).MaximumLength(40);
        RuleFor(x => x.Address).MaximumLength(200);
        RuleFor(x => x.City).MaximumLength(100);
        RuleFor(x => x.PostalCode).MaximumLength(20);
        RuleFor(x => x.Notes).MaximumLength(4000);
    }
}

public class SaveServiceLocationRequestValidator : AbstractValidator<SaveServiceLocationRequest>
{
    public SaveServiceLocationRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Address).NotEmpty().MaximumLength(200);
        RuleFor(x => x.City).MaximumLength(100);
        RuleFor(x => x.PostalCode).MaximumLength(20);
        RuleFor(x => x.Notes).MaximumLength(4000);
    }
}

public class CreateTechnicianRequestValidator : AbstractValidator<CreateTechnicianRequest>
{
    public CreateTechnicianRequestValidator()
    {
        RuleFor(x => x.Specialty).MaximumLength(150);
        RuleFor(x => x.Notes).MaximumLength(4000);
        RuleFor(x => x.Phone).MaximumLength(40);

        When(x => x.UserId is null, () =>
        {
            RuleFor(x => x.FirstName).NotEmpty().WithMessage("First name is required when userId is not supplied.").MaximumLength(100);
            RuleFor(x => x.LastName).NotEmpty().WithMessage("Last name is required when userId is not supplied.").MaximumLength(100);
            RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
            RuleFor(x => x.Password).StrongPassword();
        });
    }
}

public class UpdateTechnicianRequestValidator : AbstractValidator<UpdateTechnicianRequest>
{
    public UpdateTechnicianRequestValidator()
    {
        RuleFor(x => x.FirstName).MaximumLength(100);
        RuleFor(x => x.LastName).MaximumLength(100);
        RuleFor(x => x.Specialty).MaximumLength(150);
        RuleFor(x => x.Phone).MaximumLength(40);
        RuleFor(x => x.Notes).MaximumLength(4000);
    }
}

public class SaveJobRequestValidator : AbstractValidator<SaveJobRequest>
{
    public SaveJobRequestValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.ServiceLocationId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(8000);
        RuleFor(x => x.InternalNotes).MaximumLength(8000);
        RuleFor(x => x.Priority).IsInEnum().When(x => x.Priority.HasValue);
        RuleFor(x => x.EstimatedDurationMinutes).InclusiveBetween(1, 60 * 24 * 30).When(x => x.EstimatedDurationMinutes.HasValue);
    }
}

public class ScheduleJobRequestValidator : AbstractValidator<ScheduleJobRequest>
{
    public ScheduleJobRequestValidator()
    {
        RuleFor(x => x.ScheduledStart).NotEmpty();
        RuleFor(x => x.ScheduledEnd).NotEmpty().GreaterThan(x => x.ScheduledStart)
            .WithMessage("Scheduled end must be after scheduled start.");
    }
}

public class CompleteJobRequestValidator : AbstractValidator<CompleteJobRequest>
{
    public CompleteJobRequestValidator()
    {
        RuleFor(x => x.WorkPerformed).NotEmpty().WithMessage("Describe the work performed.").MaximumLength(8000);
        RuleFor(x => x.LaborCost).GreaterThanOrEqualTo(0).When(x => x.LaborCost.HasValue);
        RuleFor(x => x.MaterialsCost).GreaterThanOrEqualTo(0).When(x => x.MaterialsCost.HasValue);
    }
}

public class ReasonRequestValidator : AbstractValidator<ReasonRequest>
{
    public ReasonRequestValidator()
    {
        RuleFor(x => x.Reason).MaximumLength(1000);
    }
}

public class AddNoteRequestValidator : AbstractValidator<AddNoteRequest>
{
    public AddNoteRequestValidator()
    {
        RuleFor(x => x.Text).NotEmpty().MaximumLength(4000);
    }
}

public class AddJobMaterialRequestValidator : AbstractValidator<AddJobMaterialRequest>
{
    public AddJobMaterialRequestValidator()
    {
        RuleFor(x => x.MaterialId).NotEmpty();
        RuleFor(x => x.Quantity).GreaterThan(0).LessThanOrEqualTo(1_000_000);
    }
}

public class SaveMaterialRequestValidator : AbstractValidator<SaveMaterialRequest>
{
    public SaveMaterialRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Sku).MaximumLength(64);
        RuleFor(x => x.Description).MaximumLength(2000);
        RuleFor(x => x.Unit).MaximumLength(20);
        RuleFor(x => x.QuantityOnHand).GreaterThanOrEqualTo(0).LessThanOrEqualTo(1_000_000_000);
        RuleFor(x => x.MinimumQuantity).GreaterThanOrEqualTo(0).LessThanOrEqualTo(1_000_000_000);
        RuleFor(x => x.UnitCost).GreaterThanOrEqualTo(0).LessThanOrEqualTo(1_000_000_000);
    }
}

public class SaveEquipmentRequestValidator : AbstractValidator<SaveEquipmentRequest>
{
    public SaveEquipmentRequestValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Type).MaximumLength(100);
        RuleFor(x => x.Manufacturer).MaximumLength(100);
        RuleFor(x => x.Model).MaximumLength(100);
        RuleFor(x => x.SerialNumber).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(4000);
    }
}

public class UpdateCompanyRequestValidator : AbstractValidator<UpdateCompanyRequest>
{
    public UpdateCompanyRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Email).EmailAddress().MaximumLength(256).When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Phone).MaximumLength(40);
        RuleFor(x => x.Address).MaximumLength(200);
        RuleFor(x => x.City).MaximumLength(100);
        RuleFor(x => x.PostalCode).MaximumLength(20);
        RuleFor(x => x.Website).MaximumLength(200);
    }
}

public class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Password).StrongPassword();
        RuleFor(x => x.Role).NotEmpty().Must(r => AppRoles.All.Contains(r))
            .WithMessage($"Role must be one of: {string.Join(", ", AppRoles.All)}.");
        RuleFor(x => x.Specialty).MaximumLength(150);
    }
}
