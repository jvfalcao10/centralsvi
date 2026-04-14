import { supabase } from './supabase'

export async function logActivity(
  action: string,
  entityType: string,
  entityId?: string,
  entityName?: string,
  details?: string
) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('name').eq('user_id', user.id).single()
    : { data: null }

  await supabase.from('activity_log').insert({
    user_id: user?.id,
    user_name: profile?.name || 'Sistema',
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    details,
  })
}

export async function notify(
  title: string,
  message: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'info',
  link?: string,
  userId?: string
) {
  await supabase.from('notifications').insert({
    user_id: userId || null,
    title,
    message,
    type,
    link,
  })
}
