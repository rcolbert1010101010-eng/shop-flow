import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PartCategoriesDocs() {
  return (
    <div className="page-container space-y-6">
      <PageHeader title="Part Categories" backTo="/categories" />

      <div className="flex items-center justify-end">
        <Button variant="outline" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Part Categories organize your inventory into logical groups for searching, reporting, and
            purchasing. Categories are used on part records to standardize classification across the
            catalog.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Create categories before building large sections of the parts catalog.</li>
            <li>Update category names or descriptions to reflect new product lines.</li>
            <li>Use categories to improve filtering in inventory lists.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Concepts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Category name:</strong> Required label used across inventory and reports.</li>
            <li><strong>Description:</strong> Optional detail to clarify usage.</li>
            <li><strong>Part linkage:</strong> Parts reference categories for grouping and filtering.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step-by-step Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Create a category</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open Part Categories and click Add Category.</li>
              <li>Enter a category name and optional description.</li>
              <li>Save to add the category.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Edit a category</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Select a category from the list.</li>
              <li>Update the name or description.</li>
              <li>Save to apply changes.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules / Constraints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Category name is required.</li>
            <li>Use consistent naming to avoid duplicates.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Mistakes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Creating overlapping categories with similar names.</li>
            <li>Leaving descriptions blank when categories are ambiguous.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Do categories affect pricing?</p>
            <p>Categories are organizational only and do not change pricing by themselves.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can a part have multiple categories?</p>
            <p>Each part uses a single category in the current UI.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>No bulk category import or merge tools in the UI.</li>
            <li>Reporting is limited to category usage in existing lists.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
