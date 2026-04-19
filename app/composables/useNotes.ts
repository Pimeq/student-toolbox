import { useState } from '#imports'
import type { Enums, Tables } from '~/types/database.types'

type MembershipRole = Enums<'membership_role'>
type GroupType = Enums<'group_type'>
type MembershipRecord = Pick<Tables<'user_memberships'>, 'group_id' | 'role' | 'created_at'>
type GroupRecord = Pick<Tables<'groups'>, 'id' | 'name' | 'type'>
type FileRecord = Pick<Tables<'files'>, 'id' | 'object_id' | 'group_id' | 'uploaded_by' | 'name' | 'created_at'>

export type NoteVisibility = 'personal' | 'shared'
export type NoteColor = 'blue' | 'emerald' | 'purple' | 'amber' | 'rose' | 'orange'

export interface NoteItem {
  id: string
  database_id: string
  group_id: string | null
  shared_group_id: string | null
  uploaded_by: string
  is_owner: boolean
  visibility: NoteVisibility
  title: string
  content: string
  preview: string
  updated_at: string
  color: NoteColor
  user_role: MembershipRole | null
  can_edit: boolean
  group_name: string | null
  group_type: GroupType | null
  shared_by_label: string
}

interface GroupWithRole extends GroupRecord {
  role: MembershipRole
}

interface NoteUploaderInfoRow {
  uploader_user_id: string
  uploader_email: string | null
  uploader_metadata: Record<string, any> | null
  uploader_role: MembershipRole | null
}

const NOTE_COLORS: NoteColor[] = ['blue', 'emerald', 'purple', 'amber', 'rose', 'orange']

const canRoleEditSharedNote = (role: MembershipRole | null | undefined) => role === 'admin' || role === 'instructor'

const formatUploaderLabel = (isOwner: boolean, row: NoteUploaderInfoRow | null, uploadedBy: string) => {
  const metadata = row?.uploader_metadata || null
  const metadataName = (metadata?.full_name || metadata?.name || metadata?.display_name || '').trim()
  const fallbackName = row?.uploader_email || `Uzytkownik ${uploadedBy.slice(0, 8)}`
  const actor = isOwner ? 'Ty' : (metadataName || fallbackName)
  const roleSuffix = row?.uploader_role ? ` (${row.uploader_role})` : ''
  return `${actor}${roleSuffix}`
}

export const useNotes = () => {
  const notes = useState<NoteItem[]>('user-notes', () => [])
  const membershipRoleByGroup = useState<Record<string, MembershipRole>>('membership-role-by-group', () => ({}))
  
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

    if (error) {
      throw error
    }

    return (memberships || []).filter(membership => Boolean(membership.group_id)) as MembershipRecord[]
  }

  const getMembershipGroupIds = async (currentUserId: string) => {
    const memberships = await getUserMemberships(currentUserId)
    return memberships.map(membership => membership.group_id)
  }

  const getUserGroups = async (): Promise<GroupWithRole[]> => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) return []

    const memberships = await getUserMemberships(currentUserId)
    if (memberships.length === 0) return []

    const uniqueGroupIds = [...new Set(memberships.map(membership => membership.group_id))]

    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name, type')
      .in('id', uniqueGroupIds)

    if (groupsError) throw groupsError

    const groupsById = new Map((groups || []).map(group => [group.id, group as GroupRecord]))

    return memberships
      .map(membership => {
        const group = groupsById.get(membership.group_id)
        if (!group) return null

        return {
          ...group,
          role: membership.role
        }
      })
        .filter(Boolean) as GroupWithRole[]
  }

  const extractPreview = (content: string) => {
    const plainText = content.replace(/[#*_~`>[\]]/g, '').trim()
    if (!plainText) return 'Pusta notatka'
    return plainText.length > 100 ? `${plainText.substring(0, 100)}...` : plainText
  }

  const extractFirstH1 = (content: string) => {
    const match = content.match(/^#(?!#)\s+(.+)$/m)
    return match?.[1]?.trim() || null
  }

  const syncFirstH1WithTitle = (content: string, rawTitle: string) => {
    const safeTitle = rawTitle.trim() || 'Nowa Notatka'
    const normalized = content || ''

    if (!normalized.trim()) {
      return `# ${safeTitle}\n\n`
    }

    const lines = normalized.split(/\r?\n/)
    const firstH1Index = lines.findIndex(line => /^#(?!#)\s+/.test(line))

    if (firstH1Index >= 0) {
      lines[firstH1Index] = `# ${safeTitle}`
      return lines.join('\n')
    }

    return `# ${safeTitle}\n\n${normalized.replace(/^\s+/, '')}`
  }

  const resolveStoragePath = async (ownerUserId: string, objectId: string) => {
    const { data: list, error: listError } = await supabase.storage
      .from('files')
      .list(`notes/${ownerUserId}`, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      })

    if (listError || !list) {
      throw new Error(`Nie udało się odczytać listy plików notatek: ${listError?.message || 'brak danych'}`)
    }

    const fileInfo = list.find(file => file.id === objectId)
    if (!fileInfo) {
      return null
    }

    return `notes/${ownerUserId}/${fileInfo.name}`
  }

  const getMembershipRoleForGroup = async (currentUserId: string, groupId: string) => {
    const cachedRole = membershipRoleByGroup.value[groupId]
    if (cachedRole) {
      return cachedRole
    }

    const { data, error } = await supabase
      .from('user_memberships')
      .select('role')
      .eq('user_id', currentUserId)
      .eq('group_id', groupId)
      .maybeSingle()

    if (error) {
      throw error
    }

    const role = (data?.role as MembershipRole | undefined) || null
    if (role) {
      membershipRoleByGroup.value = {
        ...membershipRoleByGroup.value,
        [groupId]: role
      }
    }

    return role
  }

  const assertCanEditNote = async (note: NoteItem, currentUserId: string) => {
    if (note.visibility === 'personal') {
      if (note.uploaded_by !== currentUserId) {
        throw new Error('Mozesz edytowac tylko swoje notatki prywatne.')
      }

      note.can_edit = true
      return
    }

    if (!note.group_id) {
      throw new Error('Nieprawidlowe dane notatki wspoldzielonej.')
    }

    const role = note.user_role || (await getMembershipRoleForGroup(currentUserId, note.group_id))
    note.user_role = role
    note.can_edit = canRoleEditSharedNote(role)

    if (!note.can_edit) {
      throw new Error('Edycja notatek wspoldzielonych jest dostepna tylko dla roli instructor lub admin.')
    }
  }

  const fetchNoteById = async (noteId: string) => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) throw new Error('Brak autoryzacji')

    const { data: note, error: noteError } = await supabase
      .from('files')
      .select('id, object_id, group_id, uploaded_by, name, created_at')
      .eq('object_id', noteId)
      .eq('file_type', 'note')
      .maybeSingle<FileRecord>()

    if (noteError || !note) {
      throw new Error(noteError ? 'Błąd pobierania notatki' : 'Notatka nie istnieje')
    }

    const isOwner = note.uploaded_by === currentUserId

    let role: MembershipRole | null = null
    let group: { id: string; name: string; type: string } | null = null

    if (note.group_id) {
      role = await getMembershipRoleForGroup(currentUserId, note.group_id)
      if (!role) throw new Error('Nie masz dostępu do tej notatki')

      const { data: groupRow } = await supabase
        .from('groups')
        .select('id, name, type')
        .eq('id', note.group_id)
        .maybeSingle<{ id: string; name: string; type: string }>()
        
      if (groupRow) group = groupRow
    } else if (!isOwner) {
      throw new Error('Nie masz dostępu do tej notatki')
    }

    const storagePath = await resolveStoragePath(note.uploaded_by, note.object_id)
    if (!storagePath) throw new Error('Nie znaleziono pliku w storage')

    const { data: fileData, error: fileError } = await supabase.storage
      .from('files')
      .download(storagePath)

    if (fileError || !fileData) throw new Error('Nie udało się odczytać pliku')

    const content = await fileData.text()
    const h1Title = extractFirstH1(content)

    let sharedByLabel = isOwner ? 'Ty' : `Uzytkownik ${note.uploaded_by.slice(0, 8)}`
    const { data: uploaderRows, error: uploaderError } = await (supabase as any)
      .rpc('get_note_uploader_info', { note_object_id: note.object_id })
      
    if (!uploaderError && uploaderRows?.length) {
      sharedByLabel = formatUploaderLabel(isOwner, uploaderRows[0] as NoteUploaderInfoRow, note.uploaded_by)
    }

    return {
      id: note.object_id,
      title: h1Title || note.name,
      content,
      visibility: note.group_id ? 'shared' : 'personal' as NoteVisibility,
      group,
      isOwner,
      canEdit: note.group_id ? canRoleEditSharedNote(role) : isOwner,
      sharedByLabel,
      uploadedBy: note.uploaded_by,
      userRole: role,
      updatedAt: note.created_at
    }
  }

  const fetchNotes = async () => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) return

    const existingById = new Map(notes.value.map(note => [note.id, note]))

    const memberships = await getUserMemberships(currentUserId)
    const membershipGroupIds = memberships.map(membership => membership.group_id)
    const membershipMap = memberships.reduce<Record<string, MembershipRole>>((acc, membership) => {
      acc[membership.group_id] = membership.role
      return acc
    }, {})
    membershipRoleByGroup.value = membershipMap

    let groupsById = new Map<string, GroupRecord>()
    if (membershipGroupIds.length > 0) {
      const { data: groupRows, error: groupsError } = await supabase
        .from('groups')
        .select('id, name, type')
        .in('id', membershipGroupIds)

      if (!groupsError) {
        groupsById = new Map((groupRows || []).map(group => [group.id, group as GroupRecord]))
      }
    }

    const { data: personalData, error: personalError } = await supabase
      .from('files')
      .select('id, object_id, group_id, uploaded_by, name, created_at')
      .eq('uploaded_by', currentUserId)
      .is('group_id', null)
      .eq('file_type', 'note')
      .order('created_at', { ascending: false })

    if (personalError) {
      console.error('Błąd pobierania notatek personalnych:', personalError)
      return
    }

    let sharedData: FileRecord[] = []
    if (membershipGroupIds.length > 0) {
      const { data: groupData, error: groupError } = await supabase
        .from('files')
        .select('id, object_id, group_id, uploaded_by, name, created_at')
        .in('group_id', membershipGroupIds)
        .eq('file_type', 'note')
        .order('created_at', { ascending: false })

      if (groupError) {
        console.error('Błąd pobierania notatek współdzielonych:', groupError)
      } else {
        sharedData = (groupData || []) as FileRecord[]
      }
    }

    const mergedByObjectId = new Map<string, FileRecord>()
    for (const row of [...sharedData, ...((personalData || []) as FileRecord[])]) {
      if (!row.group_id && row.uploaded_by !== currentUserId) {
        continue
      }

      if (row.group_id && !membershipMap[row.group_id]) {
        continue
      }

      mergedByObjectId.set(row.object_id, row)
    }

    const data = [...mergedByObjectId.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    
    // Mapujemy z bazy na lokalny format
    notes.value = data.map(dbFile => {
      const existingNote = existingById.get(dbFile.object_id)
      const isOwner = dbFile.uploaded_by === currentUserId
      const noteVisibility: NoteVisibility = dbFile.group_id ? 'shared' : 'personal'
      const role = dbFile.group_id ? membershipMap[dbFile.group_id] || null : null
      const noteColor = NOTE_COLORS.includes(existingNote?.color || 'blue')
        ? (existingNote?.color as NoteColor)
        : 'emerald'
      const group = dbFile.group_id ? groupsById.get(dbFile.group_id) : null

      return {
        id: dbFile.object_id,
        database_id: dbFile.id,
        group_id: dbFile.group_id,
        shared_group_id: dbFile.group_id || existingNote?.shared_group_id || null,
        uploaded_by: dbFile.uploaded_by,
        is_owner: isOwner,
        visibility: noteVisibility,
        title: dbFile.name,
        content: existingNote?.content || '',
        preview: existingNote?.preview || 'Ładowanie podglądu...',
        updated_at: existingNote?.updated_at || dbFile.created_at,
        color: noteColor,
        user_role: role,
        can_edit: noteVisibility === 'personal' ? isOwner : canRoleEditSharedNote(role),
        group_name: group?.name || null,
        group_type: group?.type || null,
        shared_by_label: isOwner ? 'Ty' : `Uzytkownik ${dbFile.uploaded_by.slice(0, 8)}`
      }
    })

    const sharedNotes = notes.value.filter(note => note.visibility === 'shared')
    await Promise.all(sharedNotes.map(async (note) => {
      const { data: uploaderRows, error: uploaderError } = await (supabase as any)
        .rpc('get_note_uploader_info', {
          note_object_id: note.id
        })

      if (uploaderError) {
        console.error('Blad pobierania danych udostepniajacego notatke:', uploaderError)
        return
      }

      const uploaderRow = ((uploaderRows || [])[0] || null) as NoteUploaderInfoRow | null
      note.shared_by_label = formatUploaderLabel(note.is_owner, uploaderRow, note.uploaded_by)
    }))

    const fileNameByOwner = new Map<string, Map<string, string>>()
    const ownerIds = [...new Set(notes.value.map(note => note.uploaded_by).filter(Boolean))]

    await Promise.all(ownerIds.map(async (ownerId: string) => {
      const { data: storageList, error: storageListError } = await supabase.storage
        .from('files')
        .list(`notes/${ownerId}`, {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        })

      if (storageListError || !storageList) {
        console.error(`Błąd listowania plików notatek dla użytkownika ${ownerId}:`, storageListError)
        fileNameByOwner.set(ownerId, new Map())
        return
      }

      const safeEntries = storageList
        .filter(file => Boolean(file.id))
        .map(file => [file.id as string, file.name] as const)

      fileNameByOwner.set(ownerId, new Map(safeEntries))
    }))

    await Promise.all(notes.value.map(async (note) => {
      const ownerMap = fileNameByOwner.get(note.uploaded_by || '')
      const fileName = ownerMap?.get(note.id)
      if (!fileName) {
        note.preview = 'Brak podglądu treści'
        return
      }

      const storagePath = `notes/${note.uploaded_by}/${fileName}`

      let text: string | null = null

      // Signed URL + no-store ogranicza zwracanie starej wersji po szybkim przejściu na kafelki.
      const { data: signedData, error: signedError } = await supabase.storage
        .from('files')
        .createSignedUrl(storagePath, 60)

      if (!signedError && signedData?.signedUrl) {
        try {
          const response = await fetch(signedData.signedUrl, { cache: 'no-store' })
          if (response.ok) {
            text = await response.text()
          }
        } catch (error) {
          console.error('Błąd pobierania podglądu przez signed URL:', error)
        }
      }

      if (text === null) {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('files')
          .download(storagePath)

        if (downloadError || !fileData) {
          note.preview = 'Brak podglądu treści'
          return
        }

        text = await fileData.text()
      }

      const h1Title = extractFirstH1(text)
      if (h1Title) {
        note.title = h1Title
      }

      note.content = text
      note.preview = extractPreview(text)
    }))
  }

  const getNote = (id: string) => {
    return notes.value.find(n => n.id === id)
  }

  const addNote = async (title?: string) => {
    const currentUserId = await getCurrentUserId()

    if (!currentUserId) throw new Error("Brak autoryzacji (nie znaleziono w sesji Supabase)")

    const defaultTitle = title?.trim() || 'Nowa Notatka'
    const defaultContent = `# ${defaultTitle}\n\nZacznij pisać tutaj...`
    
    const fileBlob = new Blob([defaultContent], { type: 'text/markdown' })
    const storagePath = `notes/${currentUserId}/${Date.now()}.md`

    // Wrzucenie pliku-szablonu od razu do Storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from('files')
      .upload(storagePath, fileBlob, {
        contentType: 'text/markdown',
        cacheControl: '0'
      })

    if (storageError) {
      console.error('Błąd tworzenia notatki (Storage):', storageError)
      throw storageError
    }

    const objectId = (storageData as any)?.id
    if (!objectId) throw new Error("Brak objectId ze Storage")

    // Zapis do tabeli public.files (by widać było notatkę)
    const insertPayload: any = {
      object_id: objectId,
      uploaded_by: currentUserId,
      group_id: null,
      name: defaultTitle,
      size: fileBlob.size,
      mime_type: 'text/markdown',
      file_type: 'note'
    }

    const { data: dbData, error: dbError } = await supabase
      .from('files')
      .insert(insertPayload)
      .select()
      .single()

    if (dbError) {
      console.error('Błąd tworzenia notatki (DB):', dbError)
      throw dbError
    }

    // Dodanie do lokalnego stanu z ID wygenerowanym przez serwer
    notes.value.unshift({
      id: objectId,
      database_id: dbData.id,
      group_id: null,
      shared_group_id: null,
      uploaded_by: currentUserId,
      is_owner: true,
      visibility: 'personal',
      title: defaultTitle,
      content: defaultContent,
      preview: 'Zacznij pisać tutaj...',
      updated_at: dbData.created_at,
      color: 'emerald',
      user_role: null,
      can_edit: true,
      group_name: null,
      group_type: null,
      shared_by_label: 'Ty'
    })
    
    return objectId
  }

  const updateTitle = async (id: string, title: string) => {
    const safeTitle = title.trim() || 'Nowa Notatka'
    const note = getNote(id)
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) throw new Error('Brak autoryzacji użytkownika.')
    if (!note) throw new Error('Nie znaleziono notatki.')

    await assertCanEditNote(note, currentUserId)

    note.title = safeTitle
    note.updated_at = new Date().toISOString()
    note.content = syncFirstH1WithTitle(note.content || '', safeTitle)
    note.preview = extractPreview(note.content)

    const { error: dbNameError } = await supabase
      .from('files')
      .update({ name: safeTitle })
      .eq('object_id', id)

    if (dbNameError) {
      throw dbNameError
    }

    const ownerUserId = note.uploaded_by || currentUserId
    const storagePath = await resolveStoragePath(ownerUserId, id)
    if (!storagePath) {
      return
    }

    const sourceContent = note.content || (await getNoteContent(id)) || ''
    const syncedContent = syncFirstH1WithTitle(sourceContent, safeTitle)
    const fileBlob = new Blob([syncedContent], { type: 'text/markdown' })

    const { error: storageError } = await supabase.storage
      .from('files')
      .update(storagePath, fileBlob, {
        contentType: 'text/markdown',
        cacheControl: '0',
        upsert: true
      })

    if (storageError) {
      throw storageError
    }

    const { error: dbMetaError } = await supabase
      .from('files')
      .update({
        name: safeTitle,
        size: fileBlob.size
      })
      .eq('object_id', id)

    if (dbMetaError) {
      throw dbMetaError
    }

    note.content = syncedContent
    note.preview = extractPreview(syncedContent)
  }

  const getNoteContent = async (objectId: string) => {
    if (!objectId) return null

    const currentUserId = await getCurrentUserId()
    if (!currentUserId) return null

    const note = getNote(objectId)
    const ownerUserId = note?.uploaded_by || currentUserId

    let path: string | null = null
    try {
      path = await resolveStoragePath(ownerUserId, objectId)
    } catch (error) {
      console.error('Blad listowania w poszukiwaniu ścieżki pliku', error)
      return null
    }

    if (!path) return null // Nie znalezlismy pliku

    // Używamy signed URL + no-store by wymusić świeżą treść po zapisie.
    const { data: signedData, error: signedError } = await supabase.storage
      .from('files')
      .createSignedUrl(path, 60)

    if (!signedError && signedData?.signedUrl) {
      try {
        const response = await fetch(signedData.signedUrl, { cache: 'no-store' })
        if (!response.ok) {
          console.error('Błąd pobierania signed URL markdowna:', response.status, response.statusText)
          return null
        }
        return await response.text()
      } catch (error) {
        console.error('Błąd fetch signed URL markdowna:', error)
        return null
      }
    }

    const { data, error } = await supabase.storage.from('files').download(path)
    
    if (error || !data) {
      console.error('Błąd pobierania Markdown z bucketu:', error)
      return null
    }
    
    return await data.text()
  }

  const saveNote = async (id: string, content: string, preferredTitle?: string) => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) throw new Error("Brak autoryzacji (nie znaleziono w sesji Supabase)")

    const note = getNote(id)
    if (!note) {
      throw new Error('Nie znaleziono notatki w lokalnym stanie. Odśwież listę notatek i spróbuj ponownie.')
    }

    await assertCanEditNote(note, currentUserId)

    const preferred = preferredTitle?.trim() || ''
    const h1Title = extractFirstH1(content) || ''
    const finalTitle = preferred || h1Title || note.title || 'Nowa Notatka'
    const syncedContent = syncFirstH1WithTitle(content, finalTitle)

    note.title = finalTitle
    note.content = syncedContent
    note.preview = extractPreview(syncedContent)
    note.updated_at = new Date().toISOString()

    const fileBlob = new Blob([syncedContent], { type: 'text/markdown' })

    const ownerUserId = note.uploaded_by || currentUserId
    const storagePath = await resolveStoragePath(ownerUserId, id)
    if (!storagePath) {
      throw new Error('Nie znaleziono pliku notatki w Storage. Odśwież listę notatek i spróbuj ponownie.')
    }

    const { error: storageError } = await supabase.storage
      .from('files')
      .update(storagePath, fileBlob, {
        contentType: 'text/markdown',
        cacheControl: '0',
        upsert: true
      })

    if (storageError) {
      console.error('Błąd wgrywania pliku:', storageError)
      throw storageError
    }

    const { error: dbError } = await supabase
      .from('files')
      .update({
        size: fileBlob.size,
        name: finalTitle
      })
      .eq('object_id', id)

    if (dbError) {
      console.error('Błąd aktualizacji metadanych notatki w DB:', dbError)
      throw dbError
    }

    return id
  }

  const deleteNote = async (id: string) => {
    const noteToDelete = getNote(id)
    if (!noteToDelete || id.startsWith('temp-')) {
      // Jeśli to tylko tymczasowa notatka z frontu, to wystarczy ją usunąć z tablicy
      notes.value = notes.value.filter(n => n.id !== id)
      return
    }

    if (!user.value) throw new Error("Wymagane logowanie")

    const currentUserId = await getCurrentUserId()
    if (!currentUserId) throw new Error('Brak autoryzacji użytkownika.')

    if (noteToDelete.uploaded_by && noteToDelete.uploaded_by !== currentUserId) {
      throw new Error('Nie możesz usuwać notatki udostępnionej przez inną osobę.')
    }
    
    // Usuń z tabeli public.files
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('object_id', id)
      
    if (dbError) {
      console.error('Błąd usuwania notatki z bazy:', dbError)
      throw dbError
    }
    
    // Należy także usunąć plik ze storage bucketu (jeśli przechowujemy path lub objectId pasuje). 
    // W prawdziwym środowisku może do tego służyć Postgres Trigger na tabeli files lub osobne query.
    
    // Usuń w stanie aplikacji
    notes.value = notes.value.filter(n => n.id !== id)
  }

  const duplicateNote = async (id: string) => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) throw new Error("Brak autoryzacji.")

    const originalNote = getNote(id)
    if (!originalNote) throw new Error('Nie znaleziono notatki do skopiowania.')

    if (originalNote.uploaded_by && originalNote.uploaded_by !== currentUserId) {
      throw new Error('Nie możesz kopiować (duplikować) notatki, której nie jesteś autorem.')
    }

    const content = originalNote.content || (await getNoteContent(originalNote.id)) || ''
    const newTitle = `${originalNote.title} (Kopia)`
    const newContent = syncFirstH1WithTitle(content, newTitle)

    const fileBlob = new Blob([newContent], { type: 'text/markdown' })
    const storagePath = `notes/${currentUserId}/${Date.now()}.md`

    const { data: storageData, error: storageError } = await supabase.storage
      .from('files')
      .upload(storagePath, fileBlob, {
        contentType: 'text/markdown',
        cacheControl: '0'
      })

    if (storageError) {
      console.error('Błąd kopiowania notatki (Storage):', storageError)
      throw storageError
    }

    const objectId = (storageData as any)?.id
    if (!objectId) throw new Error("Brak objectId ze Storage")

    const insertPayload: any = {
      object_id: objectId,
      uploaded_by: currentUserId,
      group_id: null, // kopia zawsze trafia na prywatny profil
      name: newTitle,
      size: fileBlob.size,
      mime_type: 'text/markdown',
      file_type: 'note'
    }

    const { data: dbData, error: dbError } = await supabase
      .from('files')
      .insert(insertPayload)
      .select()
      .single()

    if (dbError) {
      console.error('Błąd tworzenia kopii notatki (DB):', dbError)
      throw dbError
    }

    notes.value.unshift({
      id: objectId,
      database_id: dbData.id,
      group_id: null,
      shared_group_id: null,
      uploaded_by: currentUserId,
      is_owner: true,
      visibility: 'personal',
      title: newTitle,
      content: newContent,
      preview: extractPreview(newContent),
      updated_at: dbData.created_at,
      color: originalNote.color || 'emerald',
      user_role: null,
      can_edit: true,
      group_name: null,
      group_type: null,
      shared_by_label: 'Ty'
    })

    return objectId
  }

  const setNoteVisibility = async (id: string, visibility: 'personal' | 'shared', targetGroupIdOverride?: string) => {
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) throw new Error('Brak autoryzacji użytkownika.')

    const note = getNote(id)
    if (!note) throw new Error('Nie znaleziono notatki.')

    if (note.uploaded_by && note.uploaded_by !== currentUserId) {
      throw new Error('Możesz zmieniać typ tylko własnych notatek.')
    }

    let targetGroupId: string | null = null
    if (visibility === 'shared') {
      if (targetGroupIdOverride) {
        targetGroupId = targetGroupIdOverride
      } else if (note.shared_group_id) {
        targetGroupId = note.shared_group_id
      } else {
        throw new Error('Brak wybranej grupy. Musisz wskazać grupę, której chcesz udostępnić notatkę.')
      }
    } else {
      if (note.group_id) {
        note.shared_group_id = note.group_id
      }
      targetGroupId = null
    }

    if (visibility === 'shared' && !targetGroupId) {
      throw new Error('Brak grupy współdzielonej. Nie można ustawić notatki współdzielonej.')
    }

    if (targetGroupId) {
      const membershipGroupIds = await getMembershipGroupIds(currentUserId)
      if (!membershipGroupIds.includes(targetGroupId)) {
        throw new Error('Nie należysz do wybranej grupy. Wybierz grupę, do której masz członkostwo.')
      }
    }

    const updatePayload = { group_id: targetGroupId }

    const { data: updatedData, error } = await supabase
      .from('files')
      .update(updatePayload as any)
      .eq('object_id', id)
      .select('id')

    if (error) {
      throw error
    }

    if (!updatedData || updatedData.length === 0) {
      throw new Error('Zapis odrzucony: brak uprawnień z powodu konfiguracji bazy danych (RLS).')
    }

    note.group_id = targetGroupId
    if (targetGroupId) {
      note.shared_group_id = targetGroupId
      note.user_role = membershipRoleByGroup.value[targetGroupId] || null
    }
    note.visibility = targetGroupId ? 'shared' : 'personal'
    note.can_edit = note.visibility === 'shared' ? canRoleEditSharedNote(note.user_role) : note.is_owner

    const nextGroup = targetGroupId
      ? (await supabase.from('groups').select('name, type').eq('id', targetGroupId).maybeSingle()).data
      : null

    note.group_name = nextGroup?.name || null
    note.group_type = (nextGroup?.type as GroupType | undefined) || null
    note.updated_at = new Date().toISOString()
  }

  return {
    notes,
    fetchNotes,
    fetchNoteById,
    getNote,
    getNoteContent,
    addNote,
    updateTitle,
    saveNote,
    deleteNote,
    duplicateNote,
    getUserGroups,
    setNoteVisibility
  }
}