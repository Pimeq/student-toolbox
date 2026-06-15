import { useState } from '#imports'
import type { Enums, Tables } from '~/types/database.types'

type MembershipRole = Enums<'membership_role'>
type GroupType = Enums<'group_type'>
type MembershipRecord = Pick<Tables<'user_memberships'>, 'group_id' | 'role' | 'created_at'>
type GroupRecord = Pick<Tables<'groups'>, 'id' | 'name' | 'type'>

export type FileVisibility = 'personal' | 'shared'

export interface StoredFile {
  id: string
  database_id: string
  group_id: string | null
  shared_group_id: string | null
  uploaded_by: string
  is_owner: boolean
  visibility: FileVisibility
  name: string
  size: number | null
  mime_type: string | null
  created_at: string
  group_name: string | null
  group_type: GroupType | null
  user_role: MembershipRole | null
}

interface GroupWithRole extends GroupRecord {
  role: MembershipRole
}

export const useFiles = () => {
  const files = useState<StoredFile[]>('user-generic-files', () => [])
  const membershipRoleByGroup = useState<Record<string, MembershipRole>>('files-membership-role-by-group', () => ({}))

  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const getCurrentUserId = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    return currentUser?.id || user.value?.id || (user.value as any)?.sub || null
  }

  const getUserMemberships = async (currentUserId: string): Promise<MembershipRecord[]> => {
    const { data: memberships, error } = await supabase
      .from('user_memberships')
      .select('group_id, role, created_at')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return (memberships || []).filter(m => Boolean(m.group_id)) as MembershipRecord[]
  }

  const getMembershipGroupIds = async (currentUserId: string) => {
    const memberships = await getUserMemberships(currentUserId)
    return memberships.map(m => m.group_id)
  }

  const getUserGroups = async (): Promise<GroupWithRole[]> => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) return []

    const memberships = await getUserMemberships(currentUserId)
    if (memberships.length === 0) return []

    const uniqueGroupIds = [...new Set(memberships.map(m => m.group_id))]

    const { data: groups, error } = await supabase
      .from('groups')
      .select('id, name, type')
      .in('id', uniqueGroupIds)

    if (error) throw error

    const groupsById = new Map((groups || []).map(g => [g.id, g as GroupRecord]))

    return memberships
      .map(m => {
        const group = groupsById.get(m.group_id)
        if (!group) return null
        return { ...group, role: m.role }
      })
      .filter(Boolean) as GroupWithRole[]
  }

  const fetchFiles = async () => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) return

    const memberships = await getUserMemberships(currentUserId)
    const membershipGroupIds = memberships.map(m => m.group_id)
    const membershipMap = memberships.reduce<Record<string, MembershipRole>>((acc, m) => {
      acc[m.group_id] = m.role
      return acc
    }, {})
    membershipRoleByGroup.value = membershipMap

    let groupsById = new Map<string, GroupRecord>()
    if (membershipGroupIds.length > 0) {
      const { data: groupRows, error } = await supabase
        .from('groups')
        .select('id, name, type')
        .in('id', membershipGroupIds)
      if (!error) {
        groupsById = new Map((groupRows || []).map(g => [g.id, g as GroupRecord]))
      }
    }

    const { data: personalData, error: personalError } = await supabase
      .from('files')
      .select('id, object_id, group_id, uploaded_by, name, size, mime_type, created_at')
      .eq('uploaded_by', currentUserId)
      .is('group_id', null)
      .eq('file_type', 'generic')
      .order('created_at', { ascending: false })

    if (personalError) {
      console.error('Błąd pobierania plików prywatnych:', personalError)
      return
    }

    let sharedData: any[] = []
    if (membershipGroupIds.length > 0) {
      const { data: groupData, error: groupError } = await supabase
        .from('files')
        .select('id, object_id, group_id, uploaded_by, name, size, mime_type, created_at')
        .in('group_id', membershipGroupIds)
        .eq('file_type', 'generic')
        .order('created_at', { ascending: false })

      if (!groupError) {
        sharedData = groupData || []
      }
    }

    const mergedByObjectId = new Map<string, any>()
    for (const row of [...sharedData, ...(personalData || [])]) {
      if (!row.group_id && row.uploaded_by !== currentUserId) continue
      if (row.group_id && !membershipMap[row.group_id]) continue
      mergedByObjectId.set(row.object_id, row)
    }

    const data = [...mergedByObjectId.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    files.value = data.map(row => {
      const isOwner = row.uploaded_by === currentUserId
      const visibility: FileVisibility = row.group_id ? 'shared' : 'personal'
      const role = row.group_id ? membershipMap[row.group_id] || null : null
      const group = row.group_id ? groupsById.get(row.group_id) : null

      return {
        id: row.object_id,
        database_id: row.id,
        group_id: row.group_id,
        shared_group_id: row.group_id || null,
        uploaded_by: row.uploaded_by,
        is_owner: isOwner,
        visibility,
        name: row.name,
        size: row.size,
        mime_type: row.mime_type,
        created_at: row.created_at,
        group_name: group?.name || null,
        group_type: (group?.type as GroupType | undefined) || null,
        user_role: role,
      }
    })
  }

  const uploadFile = async (file: File) => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) throw new Error('Brak autoryzacji')

    const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''
    const storagePath = `generic/${currentUserId}/${Date.now()}${ext}`

    const { data: storageData, error: storageError } = await supabase.storage
      .from('files')
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600'
      })

    if (storageError) throw storageError

    const objectId = (storageData as any)?.id
    if (!objectId) throw new Error('Brak objectId ze Storage')

    const insertPayload: any = {
      object_id: objectId,
      uploaded_by: currentUserId,
      group_id: null,
      name: file.name,
      size: file.size,
      mime_type: file.type || null,
      file_type: 'generic'
    }

    const { data: dbData, error: dbError } = await supabase
      .from('files')
      .insert(insertPayload)
      .select()
      .single()

    if (dbError) throw dbError

    files.value.unshift({
      id: objectId,
      database_id: dbData.id,
      group_id: null,
      shared_group_id: null,
      uploaded_by: currentUserId,
      is_owner: true,
      visibility: 'personal',
      name: file.name,
      size: file.size,
      mime_type: file.type || null,
      created_at: dbData.created_at,
      group_name: null,
      group_type: null,
      user_role: null,
    })

    return objectId
  }

  const deleteFile = async (id: string) => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) throw new Error('Brak autoryzacji')

    const fileItem = files.value.find(f => f.id === id)
    if (!fileItem) return

    if (fileItem.uploaded_by !== currentUserId) {
      throw new Error('Nie możesz usunąć pliku należącego do innej osoby.')
    }

    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('object_id', id)

    if (dbError) throw dbError

    files.value = files.value.filter(f => f.id !== id)
  }

  const downloadFile = async (id: string) => {
    const fileItem = files.value.find(f => f.id === id)
    if (!fileItem) throw new Error('Nie znaleziono pliku')

    const { data: list, error: listError } = await supabase.storage
      .from('files')
      .list(`generic/${fileItem.uploaded_by}`, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      })

    if (listError || !list) throw new Error('Nie udało się zlokalizować pliku w storage')

    const storageFile = list.find(f => f.id === id)
    if (!storageFile) throw new Error('Plik nie istnieje w storage')

    const storagePath = `generic/${fileItem.uploaded_by}/${storageFile.name}`

    const { data: signedData, error: signedError } = await supabase.storage
      .from('files')
      .createSignedUrl(storagePath, 60)

    if (signedError || !signedData?.signedUrl) throw new Error('Nie udało się wygenerować linku do pobrania')

    const a = document.createElement('a')
    a.href = signedData.signedUrl
    a.download = fileItem.name
    a.click()
  }

  const setFileVisibility = async (id: string, visibility: FileVisibility, targetGroupIdOverride?: string) => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) throw new Error('Brak autoryzacji')

    const fileItem = files.value.find(f => f.id === id)
    if (!fileItem) throw new Error('Nie znaleziono pliku')

    if (fileItem.uploaded_by !== currentUserId) {
      throw new Error('Możesz zmieniać widoczność tylko własnych plików.')
    }

    let targetGroupId: string | null = null
    if (visibility === 'shared') {
      if (targetGroupIdOverride) {
        targetGroupId = targetGroupIdOverride
      } else if (fileItem.shared_group_id) {
        targetGroupId = fileItem.shared_group_id
      } else {
        throw new Error('Brak wybranej grupy.')
      }
    } else {
      if (fileItem.group_id) {
        fileItem.shared_group_id = fileItem.group_id
      }
      targetGroupId = null
    }

    if (targetGroupId) {
      const membershipGroupIds = await getMembershipGroupIds(currentUserId)
      if (!membershipGroupIds.includes(targetGroupId)) {
        throw new Error('Nie należysz do wybranej grupy.')
      }
    }

    const { data: updatedData, error } = await supabase
      .from('files')
      .update({ group_id: targetGroupId } as any)
      .eq('object_id', id)
      .select('id')

    if (error) throw error

    if (!updatedData || updatedData.length === 0) {
      throw new Error('Zapis odrzucony: brak uprawnień (RLS).')
    }

    fileItem.group_id = targetGroupId
    if (targetGroupId) {
      fileItem.shared_group_id = targetGroupId
      fileItem.user_role = membershipRoleByGroup.value[targetGroupId] || null
    }
    fileItem.visibility = targetGroupId ? 'shared' : 'personal'

    const nextGroup = targetGroupId
      ? (await supabase.from('groups').select('name, type').eq('id', targetGroupId).maybeSingle()).data
      : null

    fileItem.group_name = nextGroup?.name || null
    fileItem.group_type = (nextGroup?.type as GroupType | undefined) || null
  }

  return {
    files,
    fetchFiles,
    uploadFile,
    deleteFile,
    downloadFile,
    setFileVisibility,
    getUserGroups,
  }
}
