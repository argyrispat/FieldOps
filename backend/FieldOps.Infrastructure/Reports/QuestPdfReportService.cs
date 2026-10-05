using FieldOps.Application.DTOs;
using FieldOps.Application.Interfaces;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace FieldOps.Infrastructure.Reports;

public class QuestPdfReportService : IReportService
{
    private const string Brand = "#0F766E";
    private const string Muted = "#64748B";

    static QuestPdfReportService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public byte[] GenerateJobReport(JobDto job, CompanyDto company)
    {
        var materials = job.MaterialsUsed ?? [];
        var notes = (job.Notes ?? []).OrderBy(n => n.CreatedAt).ToList();
        var materialsTotal = job.MaterialsCost ?? materials.Sum(m => Math.Round(m.Quantity * m.UnitCost, 2));
        var labor = job.LaborCost ?? 0m;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(36);
                page.DefaultTextStyle(t => t.FontSize(10).FontColor("#0F172A"));

                page.Header().Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text(company.Name).FontSize(18).Bold().FontColor(Brand);
                            var contact = string.Join("  |  ",
                                new[] { company.Phone, company.Email, company.Website }.Where(s => !string.IsNullOrWhiteSpace(s)));
                            if (contact.Length > 0) c.Item().Text(contact).FontSize(9).FontColor(Muted);
                        });
                        row.ConstantItem(180).AlignRight().Column(c =>
                        {
                            c.Item().AlignRight().Text("JOB REPORT").FontSize(14).Bold();
                            c.Item().AlignRight().Text(job.JobNumber).FontSize(12).FontColor(Brand).SemiBold();
                            c.Item().AlignRight().Text($"Status: {job.Status}").FontSize(9).FontColor(Muted);
                        });
                    });
                    col.Item().PaddingTop(8).LineHorizontal(1).LineColor(Brand);
                });

                page.Content().PaddingVertical(12).Column(col =>
                {
                    col.Spacing(12);

                    col.Item().Text(job.Title).FontSize(14).Bold();

                    col.Item().Row(row =>
                    {
                        row.Spacing(16);
                        row.RelativeItem().Element(c => InfoBlock(c, "Customer", job.CustomerName, job.LocationName, job.LocationAddress));
                        row.RelativeItem().Element(c => InfoBlock(c, "Assignment",
                            $"Technician: {job.TechnicianName ?? "Unassigned"}",
                            $"Priority: {job.Priority}",
                            job.EquipmentName is null ? null : $"Equipment: {job.EquipmentName}"));
                        row.RelativeItem().Element(c => InfoBlock(c, "Schedule",
                            $"Scheduled: {Fmt(job.ScheduledStart)} - {Fmt(job.ScheduledEnd)}",
                            $"Started: {Fmt(job.ActualStart)}",
                            $"Completed: {Fmt(job.ActualEnd)}"));
                    });

                    if (!string.IsNullOrWhiteSpace(job.Description))
                        col.Item().Element(c => TextSection(c, "Description", job.Description!));

                    if (!string.IsNullOrWhiteSpace(job.WorkPerformed))
                        col.Item().Element(c => TextSection(c, "Work performed", job.WorkPerformed!));

                    if (materials.Count > 0)
                    {
                        col.Item().Column(c =>
                        {
                            c.Item().Text("Materials used").Bold().FontColor(Brand);
                            c.Item().PaddingTop(4).Table(table =>
                            {
                                table.ColumnsDefinition(cd =>
                                {
                                    cd.RelativeColumn(4);
                                    cd.RelativeColumn(1.2f);
                                    cd.RelativeColumn(1.5f);
                                    cd.RelativeColumn(1.5f);
                                });

                                table.Header(h =>
                                {
                                    h.Cell().Element(HeaderCell).Text("Material");
                                    h.Cell().Element(HeaderCell).AlignRight().Text("Qty");
                                    h.Cell().Element(HeaderCell).AlignRight().Text("Unit cost");
                                    h.Cell().Element(HeaderCell).AlignRight().Text("Total");
                                });

                                foreach (var m in materials)
                                {
                                    table.Cell().Element(BodyCell).Text(m.MaterialName);
                                    table.Cell().Element(BodyCell).AlignRight().Text($"{m.Quantity:0.###} {m.Unit}");
                                    table.Cell().Element(BodyCell).AlignRight().Text(Money(m.UnitCost));
                                    table.Cell().Element(BodyCell).AlignRight().Text(Money(Math.Round(m.Quantity * m.UnitCost, 2)));
                                }
                            });
                        });
                    }

                    col.Item().AlignRight().Width(220).Column(c =>
                    {
                        c.Item().Row(r => { r.RelativeItem().Text("Labor"); r.ConstantItem(90).AlignRight().Text(Money(labor)); });
                        c.Item().Row(r => { r.RelativeItem().Text("Materials"); r.ConstantItem(90).AlignRight().Text(Money(materialsTotal)); });
                        c.Item().PaddingTop(4).LineHorizontal(0.5f).LineColor(Muted);
                        c.Item().PaddingTop(4).Row(r =>
                        {
                            r.RelativeItem().Text("Total").Bold();
                            r.ConstantItem(90).AlignRight().Text(Money(labor + materialsTotal)).Bold();
                        });
                    });

                    if (notes.Count > 0)
                    {
                        col.Item().Column(c =>
                        {
                            c.Item().Text("Notes").Bold().FontColor(Brand);
                            foreach (var n in notes)
                            {
                                c.Item().PaddingTop(4).Column(nc =>
                                {
                                    nc.Item().Text($"{n.AuthorName}  -  {n.CreatedAt:yyyy-MM-dd HH:mm} UTC").FontSize(8).FontColor(Muted);
                                    nc.Item().Text(n.Text);
                                });
                            }
                        });
                    }

                    col.Item().PaddingTop(30).Row(row =>
                    {
                        row.Spacing(40);
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().LineHorizontal(0.5f).LineColor(Muted);
                            c.Item().PaddingTop(2).Text("Technician signature").FontSize(8).FontColor(Muted);
                        });
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().LineHorizontal(0.5f).LineColor(Muted);
                            c.Item().PaddingTop(2).Text("Customer signature").FontSize(8).FontColor(Muted);
                        });
                    });
                });

                page.Footer().AlignCenter().Text(t =>
                {
                    t.DefaultTextStyle(s => s.FontSize(8).FontColor(Muted));
                    t.Span($"{company.Name} - {job.JobNumber} - generated {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC - page ");
                    t.CurrentPageNumber();
                    t.Span(" / ");
                    t.TotalPages();
                });
            });
        }).GeneratePdf();
    }

    private static void InfoBlock(IContainer container, string title, params string?[] lines)
    {
        container.Column(c =>
        {
            c.Item().Text(title).Bold().FontColor(Brand);
            foreach (var line in lines.Where(l => !string.IsNullOrWhiteSpace(l)))
                c.Item().PaddingTop(2).Text(line!).FontSize(9);
        });
    }

    private static void TextSection(IContainer container, string title, string body)
    {
        container.Column(c =>
        {
            c.Item().Text(title).Bold().FontColor(Brand);
            c.Item().PaddingTop(2).Text(body);
        });
    }

    private static IContainer HeaderCell(IContainer c) =>
        c.Background("#F1F5F9").PaddingVertical(4).PaddingHorizontal(6).DefaultTextStyle(t => t.Bold().FontSize(9));

    private static IContainer BodyCell(IContainer c) =>
        c.BorderBottom(0.5f).BorderColor("#E2E8F0").PaddingVertical(4).PaddingHorizontal(6);

    private static string Fmt(DateTime? value) => value.HasValue ? value.Value.ToString("yyyy-MM-dd HH:mm") + " UTC" : "-";

    private static string Money(decimal value) => value.ToString("C2", System.Globalization.CultureInfo.GetCultureInfo("en-US"));
}
