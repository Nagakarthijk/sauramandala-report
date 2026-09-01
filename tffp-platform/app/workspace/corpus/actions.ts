'use server';

import { requireProject } from '@/lib/workspace';
import { pushFileToHfDataset } from '@/lib/integrations/huggingface';
import { logActivity } from '@/lib/activity';

export async function pushToHuggingFace(pathInRepo: string, content: string) {
  const { supabase, project, user } = await requireProject();

  if (!project.settings.hf_enabled || !project.settings.hf_dataset_id) {
    throw new Error('HuggingFace push is not configured for this project');
  }
  const token = process.env.HUGGINGFACE_TOKEN;
  if (!token) throw new Error('HUGGINGFACE_TOKEN is not set on the server');

  await pushFileToHfDataset({
    token,
    datasetId: project.settings.hf_dataset_id,
    pathInRepo,
    content,
    commitMessage: `Update ${pathInRepo} from TFFP Platform`,
  });

  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: 'corpus.pushed_to_huggingface',
    metadata: { path: pathInRepo, dataset: project.settings.hf_dataset_id },
  });
}
