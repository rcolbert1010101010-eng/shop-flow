import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HelpTooltip } from '@/components/help/HelpTooltip';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useRepos } from '@/repos';

export default function PlasmaTemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const repos = useRepos();
  const navigate = useNavigate();
  const tplData = id ? repos.plasma.templates.get(id) : null;
  const template = tplData?.template;
  const lines = tplData?.lines ?? [];

  const [draftName, setDraftName] = useState(template?.name ?? '');
  const [draftDesc, setDraftDesc] = useState(template?.description ?? '');
  const [lineDraft, setLineDraft] = useState({ qty_default: 1, cut_length_default: '', pierce_count_default: '', notes: '' });

  const handleSaveMeta = () => {
    if (!template) return;
    repos.plasma.templates.update(template.id, {
      name: draftName || template.name,
      description: draftDesc || null,
    });
  };

  const handleAddLine = () => {
    if (!template) return;
    repos.plasma.templates.addLine(template.id, {
      qty_default: Number(lineDraft.qty_default) || 1,
      cut_length_default: lineDraft.cut_length_default ? parseFloat(lineDraft.cut_length_default) : null,
      pierce_count_default: lineDraft.pierce_count_default ? parseFloat(lineDraft.pierce_count_default) : null,
      notes: lineDraft.notes || null,
    });
    setLineDraft({ qty_default: 1, cut_length_default: '', pierce_count_default: '', notes: '' });
  };

  const handleRemove = () => {
    if (!template) return;
    if (!confirm('Delete this template?')) return;
    repos.plasma.templates.remove(template.id);
    navigate('/plasma/templates');
  };

  if (!template) {
    return (
      <div className="page-container">
        <PageHeader title="Template Not Found" backTo="/plasma/templates" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="page-container">
        <PageHeader title={template.name} backTo="/plasma/templates" />
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium flex items-center gap-1">
              Name
              <HelpTooltip content="Short name techs recognize (e.g., 'Gusset 3/8', 'Bracket Kit')." />
            </label>
            <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveMeta}>Save</Button>
            <Button variant="destructive" onClick={handleRemove}>
              Delete
            </Button>
          </div>
        </div>
        <div className="space-y-3 border rounded-lg p-4">
          <h3 className="font-semibold">Add Line</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                Qty
                <HelpTooltip content="How many of this cut piece you're making." />
              </label>
              <Input
                type="number"
                min="1"
                value={lineDraft.qty_default}
                onChange={(e) => setLineDraft({ ...lineDraft, qty_default: parseInt(e.target.value, 10) || 1 })}
              />
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                Cut Length
                <HelpTooltip content="Total inches of cut for this line. Higher cut length = more machine time." />
              </label>
              <Input
                type="number"
                value={lineDraft.cut_length_default}
                onChange={(e) => setLineDraft({ ...lineDraft, cut_length_default: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                Pierces
                <HelpTooltip content="How many pierces (starts). Pierces add time and consumable wear." />
              </label>
              <Input
                type="number"
                value={lineDraft.pierce_count_default}
                onChange={(e) => setLineDraft({ ...lineDraft, pierce_count_default: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                Notes
                <HelpTooltip content="Special instructions: bevel, tabs, kerf notes, edge quality, etc." />
              </label>
              <Input
                value={lineDraft.notes}
                onChange={(e) => setLineDraft({ ...lineDraft, notes: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={handleAddLine}>Add Line</Button>
        </div>
      </div>

      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <span className="flex items-center gap-1">
                  Qty
                  <HelpTooltip content="How many of this cut piece you're making." />
                </span>
              </TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  Cut Length
                  <HelpTooltip content="Total inches of cut for this line. Higher cut length = more machine time." />
                </span>
              </TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  Pierces
                  <HelpTooltip content="How many pierces (starts). Pierces add time and consumable wear." />
                </span>
              </TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  Notes
                  <HelpTooltip content="Special instructions: bevel, tabs, kerf notes, edge quality, etc." />
                </span>
              </TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  No lines yet.
                </TableCell>
              </TableRow>
            ) : (
              lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.qty_default}</TableCell>
                  <TableCell>{line.cut_length_default ?? '-'}</TableCell>
                  <TableCell>{line.pierce_count_default ?? '-'}</TableCell>
                  <TableCell>{line.notes || '-'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => repos.plasma.templates.removeLine(line.id)}>
                      ×
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
    </TooltipProvider>
  );
}
