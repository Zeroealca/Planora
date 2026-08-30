import { supabase } from '@/lib/supabase/client'
import { supabaseErrorMessage } from '@/lib/supabase/errors'
import type { Json } from '@/types/database'
import type {
  ProjectPriorityOption,
  ProjectStatusOption,
} from '@/features/projects/project-options'

export async function updateProjectStatusOptions(
  projectId: string,
  options: ProjectStatusOption[],
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ status_options: options as unknown as Json })
    .eq('id', projectId)

  if (error) throw new Error(supabaseErrorMessage(error))
}

export async function updateProjectPriorityOptions(
  projectId: string,
  options: ProjectPriorityOption[],
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ priority_options: options as unknown as Json })
    .eq('id', projectId)

  if (error) throw new Error(supabaseErrorMessage(error))
}
