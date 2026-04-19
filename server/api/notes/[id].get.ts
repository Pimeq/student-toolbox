import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Enums, Tables } from '~/types/database.types'

type MembershipRole = Enums<'membership_role'>

type NoteRow = Pick<Tables<'files'>, 'id' | 'object_id' | 'group_id' | 'uploaded_by' | 'name' | 'created_at'>

interface UploaderInfoRow {
  uploader_user_id: string
  uploader_email: string | null
  uploader_metadata: Record<string, any> | null
  uploader_role: MembershipRole | null
}

const canRoleEditSharedNote = (role: MembershipRole | null) => role === 'admin' || role === 'instructor'

const formatUploaderLabel = (isOwner: boolean, row: UploaderInfoRow | null, uploadedBy: string) => {
  const metadata = row?.uploader_metadata || null
  const metadataName = (metadata?.full_name || metadata?.name || metadata?.display_name || '').trim()
  const fallbackName = row?.uploader_email || `Uzytkownik ${uploadedBy.slice(0, 8)}`
  const actor = isOwner ? 'Ty' : (metadataName || fallbackName)
  const roleSuffix = row?.uploader_role ? ` (${row.uploader_role})` : ''
  return `${actor}${roleSuffix}`
}

const extractFirstH1 = (content: string) => {
  const match = content.match(/^#(?!#)\s+(.+)$/m)
  return match?.[1]?.trim() || null
}

const resolveStoragePath = async (supabase: any, ownerUserId: string, objectId: string) => {
  const { data: list, error: listError } = await supabase.storage
    .from('files')
    .list(`notes/${ownerUserId}`, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    })

  if (listError || !list) {
    console.error('listError:', listError)
    throw createError({ statusCode: 500, message: 'Nie udalo sie odczytac listy plikow notatek.' })
  }

  const fileInfo = list.find((file: { id?: string; name: string }) => file.id === objectId)
  if (!fileInfo) {
    return null
  }

  return `notes/${ownerUserId}/${fileInfo.name}`
}

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.id) {
    throw createError({ statusCode: 401, message: 'Brak autoryzacji.' })
  }

  const noteId = getRouterParam(event, 'id')
  if (!noteId) {
    throw createError({ statusCode: 400, message: 'Brak identyfikatora notatki.' })
  }

  const supabase = await serverSupabaseClient(event)

  const { data: note, error: noteError } = await supabase
    .from('files')
    .select('id, object_id, group_id, uploaded_by, name, created_at')
    .eq('object_id', noteId)
    .eq('file_type', 'note')
    .maybeSingle<NoteRow>()

  if (noteError) {
    console.error('noteError:', noteError)
    throw createError({ statusCode: 500, message: 'Nie udalo sie pobrac notatki.' })
  }

  if (!note) {
    throw createError({ statusCode: 404, message: 'Notatka nie istnieje.' })
  }

  const isOwner = note.uploaded_by === user.id

  let role: MembershipRole | null = null
  let group: { id: string; name: string; type: string } | null = null

  if (note.group_id) {
    const { data: membership, error: membershipError } = await supabase
      .from('user_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('group_id', note.group_id)
      .maybeSingle<{ role: MembershipRole }>()

    if (membershipError) {
      console.error('membershipError:', membershipError)
      throw createError({ statusCode: 500, message: 'Nie udalo sie sprawdzic czlonkostwa w grupie.' })
    }

    if (!membership) {
      throw createError({ statusCode: 403, message: 'Nie masz dostepu do tej notatki.' })
    }

    role = membership.role

    const { data: groupRow } = await supabase
      .from('groups')
      .select('id, name, type')
      .eq('id', note.group_id)
      .maybeSingle<{ id: string; name: string; type: string }>()

    if (groupRow) {
      group = groupRow
    }
  } else if (!isOwner) {
    throw createError({ statusCode: 403, message: 'Nie masz dostepu do tej notatki.' })
  }

  const storagePath = await resolveStoragePath(supabase, note.uploaded_by, note.object_id)
  if (!storagePath) {
    throw createError({ statusCode: 404, message: 'Nie znaleziono pliku notatki w Storage.' })
  }

  const { data: fileData, error: fileError } = await supabase.storage
    .from('files')
    .download(storagePath)

  if (fileError || !fileData) {
    console.error('fileError:', fileError)
    throw createError({ statusCode: 500, message: 'Nie udalo sie odczytac tresci notatki.' })
  }

  const content = await fileData.text()
  const h1Title = extractFirstH1(content)

  let sharedByLabel = isOwner ? 'Ty' : `Uzytkownik ${note.uploaded_by.slice(0, 8)}`
  const { data: uploaderRows, error: uploaderError } = await (supabase as any)
    .rpc('get_note_uploader_info', {
      note_object_id: note.object_id
    })

  if (uploaderError) {
    console.error('Blad pobierania danych udostepniajacego notatke (RPC):', uploaderError)
  } else {
    const uploaderRow = ((uploaderRows || [])[0] || null) as UploaderInfoRow | null
    sharedByLabel = formatUploaderLabel(isOwner, uploaderRow, note.uploaded_by)
  }

  return {
    id: note.object_id,
    title: h1Title || note.name,
    content,
    visibility: note.group_id ? 'shared' : 'personal',
    group,
    isOwner,
    canEdit: note.group_id ? canRoleEditSharedNote(role) : isOwner,
    sharedByLabel,
    uploadedBy: note.uploaded_by,
    userRole: role,
    updatedAt: note.created_at
  }
})
