import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HelpTooltip } from '@/components/help/HelpTooltip';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useRepos } from '@/repos';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';

export default function PlasmaTemplates() {
  const repos = useRepos();
  const templates = repos.plasma.templates.list();
  const navigate = useNavigate();
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');

  const handleCreate = () => {
    if (!newTemplateName.trim()) return;
    const tpl = repos.plasma.templates.create({
      name: newTemplateName.trim(),
      description: newTemplateDesc.trim() || null,
      default_material_type: null,
      default_thickness: null,
    });
    setNewTemplateName('');
    setNewTemplateDesc('');
    navigate(`/plasma/templates/${tpl.id}`);
  };

  return (
    <TooltipProvider>
      <div className="page-container">
        <PageHeader title="Plasma Templates" actions={<ModuleHelpButton moduleKey="plasma_templates" />} />
        <p className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
          Reusable cut line sets for common parts. Start faster and price consistently.
          <HelpTooltip content="Reusable cut line sets for common parts. Start faster and price consistently." />
        </p>
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="md:col-span-2">
          <div className="table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      No templates yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((tpl) => (
                    <TableRow key={tpl.id}>
                      <TableCell>
                        <Link to={`/plasma/templates/${tpl.id}`} className="text-primary hover:underline">
                          {tpl.name}
                        </Link>
                      </TableCell>
                      <TableCell>{tpl.description || '-'}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {new Date(tpl.updated_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold">New Template</h3>
          <div>
            <label className="text-sm font-medium flex items-center gap-1">
              Name
              <HelpTooltip content="Short name techs recognize (e.g., 'Gusset 3/8', 'Bracket Kit')." />
            </label>
            <Input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Template name" />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea value={newTemplateDesc} onChange={(e) => setNewTemplateDesc(e.target.value)} placeholder="Optional notes" />
          </div>
          <Button onClick={handleCreate} disabled={!newTemplateName.trim()}>
            Create
          </Button>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
