import type { ModuleHelpContent } from '@/help/helpRegistry';

interface Response {
  answer: string;
  suggestions: string[];
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function countMatches(text: string, searchTerms: string[]): number {
  const normalized = normalizeText(text);
  return searchTerms.filter((term) => normalized.includes(term)).length;
}

function getModuleSuggestions(moduleKey: string): string[] {
  const suggestions: Record<string, string[]> = {
    inventory: [
      'When should I use Adjust QOH vs Receive?',
      'What does QOH mean?',
      'How do I import parts?',
      'What is a cycle count?',
      'How do remnants work?',
    ],
    parts: [
      'What UOM should I choose?',
      'How is sheet SQFT calculated?',
      "What's the difference between cost and price?",
      'How do I create a remnant?',
      'What is a core charge?',
    ],
  };
  return suggestions[moduleKey] || [
    'How do I get started?',
    'What are the key features?',
    'Where can I find more help?',
  ];
}

export function respond(
  moduleKey: string,
  content: ModuleHelpContent,
  userText: string
): Response {
  const normalized = normalizeText(userText);
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);
  
  if (words.length === 0) {
    return {
      answer: `Here's an overview of ${content.title}:\n\n${content.workflows[0]?.title || 'Get started'} workflow:\n${content.workflows[0]?.steps.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join('\n') || 'No workflows available'}`,
      suggestions: getModuleSuggestions(moduleKey),
    };
  }

  // Score sections
  const definitionScores: Array<{ def: { term: string; meaning: string }; score: number }> = [];
  const workflowScores: Array<{ workflow: { title: string; steps: string[] }; score: number }> = [];
  const tipScores: Array<{ tip: string; score: number }> = [];

  // Score definitions
  content.definitions.forEach((def) => {
    const termScore = countMatches(def.term, words);
    const meaningScore = countMatches(def.meaning, words);
    const score = termScore * 2 + meaningScore; // Terms weighted higher
    if (score > 0) {
      definitionScores.push({ def, score });
    }
  });

  // Score workflows
  content.workflows.forEach((workflow) => {
    const titleScore = countMatches(workflow.title, words);
    const stepsScore = workflow.steps.reduce((sum, step) => sum + countMatches(step, words), 0);
    const score = titleScore * 3 + stepsScore; // Title weighted higher
    if (score > 0) {
      workflowScores.push({ workflow, score });
    }
  });

  // Score tips
  content.tips.forEach((tipGroup) => {
    tipGroup.items.forEach((tip) => {
      const score = countMatches(tip, words);
      if (score > 0) {
        tipScores.push({ tip, score });
      }
    });
  });

  // Sort by score
  definitionScores.sort((a, b) => b.score - a.score);
  workflowScores.sort((a, b) => b.score - a.score);
  tipScores.sort((a, b) => b.score - a.score);

  const parts: string[] = [];

  // Add definitions (up to 3)
  if (definitionScores.length > 0) {
    const topDefs = definitionScores.slice(0, 3);
    parts.push('**Definitions:**');
    topDefs.forEach(({ def }) => {
      parts.push(`• **${def.term}**: ${def.meaning}`);
    });
  }

  // Add workflows (1-2, max 4 steps each)
  if (workflowScores.length > 0) {
    const topWorkflows = workflowScores.slice(0, 2);
    topWorkflows.forEach(({ workflow }) => {
      parts.push(`\n**${workflow.title}:**`);
      const stepsToShow = workflow.steps.slice(0, 4);
      stepsToShow.forEach((step, idx) => {
        parts.push(`${idx + 1}. ${step}`);
      });
      if (workflow.steps.length > 4) {
        parts.push(`... and ${workflow.steps.length - 4} more step${workflow.steps.length - 4 > 1 ? 's' : ''}`);
      }
    });
  }

  // Add tips (up to 5)
  if (tipScores.length > 0) {
    const topTips = tipScores.slice(0, 5);
    if (topTips.length > 0) {
      parts.push('\n**Tips:**');
      topTips.forEach(({ tip }) => {
        parts.push(`• ${tip}`);
      });
    }
  }

  // If no strong matches, show default workflows
  if (parts.length === 0) {
    if (content.workflows.length > 0) {
      parts.push(`Here are the main workflows for ${content.title}:`);
      content.workflows.slice(0, 2).forEach((workflow) => {
        parts.push(`\n**${workflow.title}:**`);
        workflow.steps.slice(0, 3).forEach((step, idx) => {
          parts.push(`${idx + 1}. ${step}`);
        });
      });
      parts.push('\nTry asking about specific terms or steps for more details.');
    } else {
      parts.push(`I can help you with ${content.title}. Try asking about specific features or terms.`);
    }
  }

  const answer = parts.join('\n');

  // Generate suggestions based on what wasn't covered
  const suggestions: string[] = [];
  if (definitionScores.length === 0 && content.definitions.length > 0) {
    suggestions.push(`What does ${content.definitions[0]?.term} mean?`);
  }
  if (workflowScores.length === 0 && content.workflows.length > 0) {
    suggestions.push(`How do I ${content.workflows[0]?.title.toLowerCase()}?`);
  }
  if (suggestions.length < 3) {
    suggestions.push(...getModuleSuggestions(moduleKey).slice(0, 3 - suggestions.length));
  }

  return {
    answer,
    suggestions: suggestions.slice(0, 3),
  };
}
