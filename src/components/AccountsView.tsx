import React, { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
  Alert,
  useMediaQuery,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import RefreshIcon from '@mui/icons-material/Refresh'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined'
import CloseIcon from '@mui/icons-material/Close'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import PersonIcon from '@mui/icons-material/Person'
import LockIcon from '@mui/icons-material/Lock'
import PhoneIcon from '@mui/icons-material/Phone'
import EmailIcon from '@mui/icons-material/Email'
import SecurityIcon from '@mui/icons-material/Security'
import NoteIcon from '@mui/icons-material/Note'
import AccountBoxIcon from '@mui/icons-material/AccountBox'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import ShieldIcon from '@mui/icons-material/Shield'
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined'
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined'
import PushPinIcon from '@mui/icons-material/PushPin'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import { v4 as uuidv4 } from 'uuid'
import AccountPlatformDialog from './AccountPlatformDialog'
import TotpCodeDisplay from './TotpCodeDisplay'
import EmptyState from './common/EmptyState'
import PageHeader from './common/PageHeader'
import SectionLabel from './common/SectionLabel'
import { useStore } from '../stores/useStore'
import { AccountRow, AccountTagUsageRow, CustomFieldRow, TagRow, UpdateAccountData } from '../types'
import {
  AccountPlatform,
  getAccountPlatformLabel,
} from '../utils/accountPlatform'
import {
  ACCOUNT_TAG_INPUT_CONTROL_HEIGHT,
  getAccountDetailSectionOrder,
  getVisibleAccountPreviewTags,
  mergeVisibleAccountOrder,
} from '../utils/accountManagerLayout'
import { generateSecurePassword } from '../utils/securePassword'
import { normalizeOtpInput } from '../utils/otpAuth'
import { buildAccountUpdatePatch } from '../utils/accountEdit'
import { shouldSubmitOnEnter } from '../utils/quickSubmit'
import useCopyFeedback from '../hooks/useCopyFeedback'

const MAX_ACCOUNT_TAG_LENGTH = 64
type AccountNotice = { severity: 'success' | 'error' | 'info'; text: string }

const PLATFORM_ACCENTS: Record<AccountPlatform, string> = {
  google: '#8ddc9f',
  microsoft: '#adc6ff',
  other: '#8fa3ba',
}

const panelSx = {
  p: 1.5,
  borderRadius: 1,
  mb: 2,
  bgcolor: 'surface.raised',
  borderColor: 'border.subtle',
  boxShadow: 'none',
}

const fieldPanelSx = {
  p: 0,
  borderRadius: 1,
  mb: 2,
  overflow: 'hidden',
  bgcolor: 'surface.raised',
  borderColor: 'border.subtle',
  boxShadow: 'none',
}

const fieldBoxSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.25,
  minHeight: 56,
  px: 1.5,
  py: 1,
  borderRadius: 0,
  border: 0,
  borderBottom: '1px solid',
  borderColor: 'border.subtle',
  bgcolor: 'transparent',
  '&:last-child': {
    borderBottom: 0,
  },
  '&:hover': {
    bgcolor: 'action.hover',
  },
}

function PlatformChip({ platform }: { platform: AccountPlatform }) {
  const accent = PLATFORM_ACCENTS[platform]

  return (
    <Chip
      size="small"
      label={getAccountPlatformLabel(platform)}
      sx={{
        height: 24,
        fontWeight: 600,
        bgcolor: `${accent}22`,
        color: accent,
        border: '1px solid',
        borderColor: `${accent}55`,
        '& .MuiChip-label': {
          px: 1,
        },
      }}
    />
  )
}

function getCreatedTagSuggestions(tags: AccountTagUsageRow[], currentTags: TagRow[] = []) {
  const currentIds = new Set(currentTags.map((tag) => tag.id))
  return tags.filter((tag) => !currentIds.has(tag.id))
}

function SensitiveField({
  icon,
  label,
  value,
  fieldKey,
  copiedField,
  onCopy,
  editing,
  onChange,
  onGenerate,
  onQuickSubmit,
  error,
  helperText,
}: {
  icon: React.ReactNode
  label: string
  value: string
  fieldKey: string
  copiedField: string | null
  onCopy: (val: string, key: string) => void
  editing: boolean
  onChange?: (val: string) => void
  onGenerate?: () => void
  onQuickSubmit?: (event: React.KeyboardEvent) => void
  error?: boolean
  helperText?: string
}) {
  const [visible, setVisible] = useState(false)
  const hasValue = value && value.length > 0
  const isSecretField = fieldKey === 'password' || fieldKey === 'totp_secret'

  useEffect(() => {
    setVisible(false)
  }, [editing, fieldKey])

  if (editing) {
    return (
      <TextField
        fullWidth
        size="small"
        label={label}
        value={value}
        type={isSecretField && !visible ? 'password' : 'text'}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={onQuickSubmit}
        error={error}
        helperText={helperText}
        InputProps={{
          startAdornment: <InputAdornment position="start">{icon}</InputAdornment>,
          endAdornment: onGenerate || isSecretField ? (
            <InputAdornment position="end">
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {onGenerate && (
                  <Tooltip title="随机生成高强度密码">
                    <IconButton size="small" aria-label="随机生成高强度密码" onClick={onGenerate}>
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {isSecretField && (
                  <Tooltip title={visible ? '隐藏敏感值' : '显示敏感值'}>
                    <IconButton
                      size="small"
                      aria-label={visible ? `隐藏${label}` : `显示${label}`}
                      onClick={() => setVisible((current) => !current)}
                      edge="end"
                    >
                      {visible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </InputAdornment>
          ) : undefined,
        }}
        sx={{ mb: 1.5 }}
      />
    )
  }

  if (!hasValue) return null

  const requiresRevealBeforeCopy = fieldKey === 'totp_secret'
  const canCopy = !requiresRevealBeforeCopy || visible
  const isCopied = copiedField === fieldKey
  const handleCopy = () => {
    if (!canCopy) return
    void onCopy(value, fieldKey)
  }

  return (
    <Box
      sx={{
        ...fieldBoxSx,
        mb: 0,
        borderColor: isCopied ? 'success.main' : 'border.subtle',
        bgcolor: isCopied ? 'rgba(52, 168, 83, 0.12)' : 'transparent',
        boxShadow: isCopied ? 'inset 0 0 0 1px rgba(52, 168, 83, 0.75)' : 'none',
        transition: 'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        '&:hover': {
          bgcolor: isCopied ? 'rgba(52, 168, 83, 0.16)' : 'action.hover',
        },
      }}
    >
      <Box
        component="button"
        type="button"
        disabled={!canCopy}
        aria-label={canCopy ? `复制${label}` : `${label}需先显示才能复制`}
        onClick={handleCopy}
        sx={{
          all: 'unset',
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          flex: 1,
          minWidth: 0,
          alignSelf: 'stretch',
          cursor: canCopy ? 'pointer' : 'default',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: isCopied ? 'success.main' : 'primary.main',
            outlineOffset: -2,
          },
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            color: 'primary.main',
            bgcolor: 'surface.sunken',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography
            variant="body2"
            className={isSecretField ? 'mono-data' : undefined}
            sx={{ color: 'text.primary', mt: 0.2, fontWeight: 600 }}
            noWrap
          >
            {isSecretField && !visible ? '••••••••' : value}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, flexShrink: 0 }}>
        {requiresRevealBeforeCopy && !visible && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.74rem', lineHeight: 1.35 }}>
            先显示
          </Typography>
        )}
        {canCopy && (
          <Tooltip title={isCopied ? '已复制' : `复制${label}`}>
            <IconButton
              size="small"
              aria-label={`复制${label}`}
              onClick={(event) => {
                event.stopPropagation()
                handleCopy()
              }}
              sx={{ color: isCopied ? 'success.main' : 'text.secondary' }}
            >
              {isCopied
                ? <CheckIcon sx={{ fontSize: 16 }} />
                : <ContentCopyIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        )}
        {isSecretField && (
          <Tooltip title={visible ? `隐藏${label}` : `显示${label}`}>
            <IconButton
              size="small"
              aria-label={visible ? `隐藏${label}` : `显示${label}`}
              onClick={(event) => {
                event.stopPropagation()
                setVisible(!visible)
              }}
              sx={{ color: 'text.secondary' }}
            >
              {visible ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}

function AccountDetail({
  accountId,
  onClose,
  editSignal,
  isPinned,
  onTogglePin,
  onNotice,
}: {
  accountId: string
  onClose: () => void
  editSignal?: number
  isPinned: boolean
  onTogglePin: (e: React.MouseEvent) => void
  onNotice: (notice: AccountNotice) => void
}) {
  const {
    addAccountTag,
    deleteTag,
    deleteAccount,
    incrementTotpCounter,
    loadAccounts,
    loadAllAccounts,
    removeAccountTag,
    totpAccounts,
    updateAccount,
    loadTotpAccounts,
    setNavigationBlockReason,
    dataRevision,
  } = useStore()
  const [account, setAccount] = useState<AccountRow | null>(null)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    platform: 'google' as AccountPlatform,
    username: '',
    password: '',
    phone: '',
    backupEmail: '',
    totpSecret: '',
    notes: '',
  })
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>([])
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')
  const [newFieldIsSecret, setNewFieldIsSecret] = useState(false)
  const [newFieldValueVisible, setNewFieldValueVisible] = useState(false)
  const [showAddField, setShowAddField] = useState(false)
  const [editingCustomField, setEditingCustomField] = useState<CustomFieldRow | null>(null)
  const [visibleCustomFieldIds, setVisibleCustomFieldIds] = useState<string[]>([])
  const [customFieldDeleteId, setCustomFieldDeleteId] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [linkTotpDialogOpen, setLinkTotpDialogOpen] = useState(false)
  const [pendingLinkPatch, setPendingLinkPatch] = useState<UpdateAccountData | null>(null)
  const [linkSecretVisible, setLinkSecretVisible] = useState(false)
  const [linkData, setLinkData] = useState({
    issuer: '',
    label: '',
    secret: '',
    otpType: 'totp',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    counter: 0,
  })
  const [tagCatalog, setTagCatalog] = useState<AccountTagUsageRow[]>([])
  const [tagContextMenu, setTagContextMenu] = useState<{
    mouseX: number
    mouseY: number
    tag: AccountTagUsageRow
  } | null>(null)
  const [tagDeleteTarget, setTagDeleteTarget] = useState<AccountTagUsageRow | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [tagBusy, setTagBusy] = useState<string | null>(null)
  const [fieldBusy, setFieldBusy] = useState(false)
  const saveBusyRef = useRef(false)
  const linkBusyRef = useRef(false)
  const tagBusyRef = useRef(false)
  const fieldBusyRef = useRef(false)
  const hotpIncrementBusyRef = useRef(false)
  const [hotpIncrementBusy, setHotpIncrementBusy] = useState(false)
  const [totpInputError, setTotpInputError] = useState('')
  const [notice, setNotice] = useState<AccountNotice | null>(null)
  const [accountLoadError, setAccountLoadError] = useState('')
  const { copiedKey: copiedField, copy } = useCopyFeedback()

  const hasUnsavedAccountChanges = Boolean(account && editing && (
    editData.name !== account.name
    || editData.platform !== account.platform
    || editData.username !== account.username
    || editData.password !== account.password
    || editData.phone !== account.phone
    || editData.backupEmail !== account.backup_email
    || editData.totpSecret !== account.totp_secret
    || editData.notes !== account.notes
  ))
  const hasUnsavedCustomFieldChanges = Boolean(showAddField && (
    editingCustomField
      ? newFieldName !== editingCustomField.field_name
        || newFieldValue !== editingCustomField.field_value
        || newFieldIsSecret !== Boolean(editingCustomField.is_secret)
      : newFieldName.trim() || newFieldValue || newFieldIsSecret
  ))

  const loadAccount = async ({ preserveDraft = false }: { preserveDraft?: boolean } = {}) => {
    try {
      const data = await window.electronAPI.getAccountById(accountId)
      if (!data) {
        setAccount(null)
        setAccountLoadError('账号不存在、已移入回收站，或备份恢复后该记录已被替换')
        return
      }

      setAccount(data)
      setCustomFields(data.customFields || [])
      if (!preserveDraft) {
        setEditData({
          name: data.name,
          platform: data.platform,
          username: data.username,
          password: data.password,
          phone: data.phone,
          backupEmail: data.backup_email,
          totpSecret: data.totp_secret,
          notes: data.notes,
        })
        setTotpInputError('')
      }

      const tags = await window.electronAPI.getAccountTags()
      setTagCatalog(tags)
      setAccountLoadError('')
    } catch (error) {
      setAccountLoadError(`读取账号失败：${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  const refreshAccountViews = async ({ preserveDraft = false, includeDetail = true, includeLists = true } = {}) => {
    const refreshes: Promise<unknown>[] = includeLists ? [loadAccounts(), loadAllAccounts(), loadTotpAccounts()] : []
    if (includeDetail) refreshes.push(loadAccount({ preserveDraft }))
    const results = await Promise.allSettled(refreshes)
    return results.some((result) => result.status === 'rejected')
  }

  useEffect(() => {
    void loadAccount().catch(() => undefined)
  }, [accountId, dataRevision])

  useEffect(() => {
    if (editSignal && editSignal > 0) {
      setEditing(true)
    }
  }, [editSignal])

  useEffect(() => {
    setNavigationBlockReason(
      hasUnsavedAccountChanges
        ? '账号修改尚未保存'
        : hasUnsavedCustomFieldChanges
          ? '自定义字段修改尚未保存'
          : null
    )
    return () => setNavigationBlockReason(null)
  }, [hasUnsavedAccountChanges, hasUnsavedCustomFieldChanges, setNavigationBlockReason])

  const handleSave = async () => {
    const name = editData.name.trim()
    if (!name || saveBusyRef.current || !account) return

    const patch = buildAccountUpdatePatch(account, { ...editData, name })
    let normalizedTotp = null as ReturnType<typeof normalizeOtpInput>
    if (patch.totpSecret !== undefined) {
      normalizedTotp = normalizeOtpInput(patch.totpSecret)
      if (!normalizedTotp) {
        setTotpInputError('请输入有效的 Base32 密钥或 otpauth:// URI')
        return
      }
      setTotpInputError('')
    }
    if (Object.keys(patch).length === 0) {
      setEditing(false)
      const refreshFailed = await refreshAccountViews({ includeLists: false })
      if (refreshFailed) {
        setNotice({ severity: 'error', text: '重新读取账号失败，请稍后重试' })
      }
      return
    }

    if (normalizedTotp?.secret && (account.linked_totp_count ?? 0) === 0) {
      const parsed = normalizedTotp.parsedUri
      setPendingLinkPatch(patch)
      setLinkData({
        issuer: parsed?.issuer || name,
        label: parsed?.label || editData.username || name,
        secret: normalizedTotp.secret,
        otpType: parsed?.otpType || 'totp',
        algorithm: parsed?.algorithm || 'SHA1',
        digits: parsed?.digits || 6,
        period: parsed?.period || 30,
        counter: parsed?.counter || 0,
      })
      setLinkSecretVisible(false)
      setLinkTotpDialogOpen(true)
      return
    }

    saveBusyRef.current = true
    setSaveBusy(true)
    try {
      const result = await updateAccount(accountId, patch, false)
      const refreshFailed = await refreshAccountViews()

      if (result.needsTotpLink && normalizedTotp?.secret) {
        const parsed = normalizedTotp.parsedUri
        setLinkData({
          issuer: parsed?.issuer || name,
          label: parsed?.label || editData.username || name,
          secret: normalizedTotp.secret,
          otpType: parsed?.otpType || 'totp',
          algorithm: parsed?.algorithm || 'SHA1',
          digits: parsed?.digits || 6,
          period: parsed?.period || 30,
          counter: parsed?.counter || 0,
        })
        setLinkSecretVisible(false)
        setPendingLinkPatch(patch)
        setLinkTotpDialogOpen(true)
        if (refreshFailed) {
          setNotice({ severity: 'info', text: '账号已保存，但界面刷新失败；绑定前请确认当前内容' })
        }
        return
      }

      setEditing(false)
      setNotice({
        severity: refreshFailed ? 'info' : 'success',
        text: refreshFailed
          ? '账号已保存，但部分界面刷新失败；重新进入账号后会再次读取'
          : result.detachedTotpCount
          ? `账号已保存；原 2FA 记录已保留为 ${result.detachedTotpCount} 条独立记录`
          : '账号已保存',
      })
    } catch (error) {
      setNotice({ severity: 'error', text: `保存失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      saveBusyRef.current = false
      setSaveBusy(false)
    }
  }

  const handleAccountQuickSubmit = (event: React.KeyboardEvent) => {
    if (
      saveBusy
      || !editData.name.trim()
      || !hasUnsavedAccountChanges
      || !shouldSubmitOnEnter(event)
    ) return

    event.preventDefault()
    void handleSave()
  }

  const handleConfirmLink = async () => {
    if (linkBusyRef.current || !pendingLinkPatch) return
    linkBusyRef.current = true
    setLinkBusy(true)
    try {
      await updateAccount(accountId, {
        ...pendingLinkPatch,
        totpSecret: linkData.secret,
        createLinkedTotp: {
          id: uuidv4(),
          issuer: linkData.issuer,
          label: linkData.label,
          otpType: linkData.otpType,
          algorithm: linkData.algorithm,
          digits: linkData.digits,
          period: linkData.period,
          counter: linkData.counter,
        },
      }, false)
      const refreshFailed = await refreshAccountViews()
      setLinkTotpDialogOpen(false)
      setPendingLinkPatch(null)
      setLinkSecretVisible(false)
      setEditing(false)
      setNotice({
        severity: refreshFailed ? 'info' : 'success',
        text: refreshFailed
          ? '2FA 已绑定，但部分界面刷新失败；重新进入后会再次读取'
          : '2FA 已绑定；验证码已使用新密钥刷新',
      })
    } catch (error) {
      setNotice({ severity: 'error', text: `绑定失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      linkBusyRef.current = false
      setLinkBusy(false)
    }
  }

  const handleSkipLink = async () => {
    if (linkBusyRef.current || !pendingLinkPatch) return
    linkBusyRef.current = true
    setLinkBusy(true)
    try {
      const normalized = normalizeOtpInput(linkData.secret)
      if (!normalized?.secret) throw new Error('2FA 密钥无效')
      await updateAccount(accountId, { ...pendingLinkPatch, totpSecret: linkData.secret }, false)
      const refreshFailed = await refreshAccountViews()
      setLinkTotpDialogOpen(false)
      setPendingLinkPatch(null)
      setLinkSecretVisible(false)
      setEditing(false)
      setNotice({
        severity: refreshFailed ? 'info' : 'success',
        text: refreshFailed
          ? '账号密钥已保存，但部分界面刷新失败；重新进入后会再次读取'
          : '账号已保存；2FA 密钥未添加到独立面板',
      })
    } catch (error) {
      setNotice({ severity: 'error', text: `保存失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      linkBusyRef.current = false
      setLinkBusy(false)
    }
  }

  const handleCancelLink = () => {
    if (linkBusy) return
    setLinkTotpDialogOpen(false)
    setPendingLinkPatch(null)
    setLinkSecretVisible(false)
  }

  const handleDelete = async () => {
    if (deleteBusy) return
    setDeleteBusy(true)
    try {
      const result = await deleteAccount(accountId)
      setDeleteConfirmOpen(false)
      onNotice({
        severity: result.refreshFailed ? 'info' : 'success',
        text: result.refreshFailed ? '账号已移入回收站，但部分列表刷新失败' : '账号已移入回收站',
      })
      onClose()
    } catch (error) {
      setNotice({ severity: 'error', text: `移入回收站失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setDeleteBusy(false)
    }
  }

  const resetCustomFieldEditor = () => {
    setNewFieldName('')
    setNewFieldValue('')
    setNewFieldIsSecret(false)
    setNewFieldValueVisible(false)
    setEditingCustomField(null)
    setShowAddField(false)
  }

  const handleCancelEdit = () => {
    if (!account) return
    setEditData({
      name: account.name,
      platform: account.platform,
      username: account.username,
      password: account.password,
      phone: account.phone,
      backupEmail: account.backup_email,
      totpSecret: account.totp_secret,
      notes: account.notes,
    })
    setTotpInputError('')
    setEditing(false)
  }

  const openAddCustomField = () => {
    if (fieldBusy) return
    setNewFieldName('')
    setNewFieldValue('')
    setNewFieldIsSecret(false)
    setNewFieldValueVisible(false)
    setEditingCustomField(null)
    setShowAddField(true)
  }

  const openEditCustomField = (field: CustomFieldRow) => {
    if (fieldBusy) return
    setNewFieldName(field.field_name)
    setNewFieldValue(field.field_value)
    setNewFieldIsSecret(Boolean(field.is_secret))
    setNewFieldValueVisible(false)
    setEditingCustomField(field)
    setShowAddField(true)
  }

  const handleSaveField = async () => {
    if (!newFieldName.trim() || fieldBusyRef.current) return
    fieldBusyRef.current = true
    setFieldBusy(true)
    try {
      if (editingCustomField) {
        const result = await window.electronAPI.updateAccountField(editingCustomField.id, {
          fieldName: newFieldName.trim(),
          fieldValue: newFieldValue,
          isSecret: newFieldIsSecret,
        })
        if (!result.success) throw new Error('自定义字段不存在或已被删除')
      } else {
        await window.electronAPI.addAccountField({
          id: uuidv4(),
          accountId,
          fieldName: newFieldName.trim(),
          fieldValue: newFieldValue,
          isSecret: newFieldIsSecret,
        })
      }
      const action = editingCustomField ? '更新' : '添加'
      resetCustomFieldEditor()
      const refreshFailed = await refreshAccountViews({ preserveDraft: true })
      setNotice({
        severity: refreshFailed ? 'info' : 'success',
        text: refreshFailed ? `自定义字段已${action}，但界面刷新失败` : `自定义字段已${action}`,
      })
    } catch (error) {
      setNotice({ severity: 'error', text: `保存自定义字段失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      fieldBusyRef.current = false
      setFieldBusy(false)
    }
  }

  const handleCustomFieldQuickSubmit = (event: React.KeyboardEvent) => {
    if (fieldBusy || !newFieldName.trim() || !shouldSubmitOnEnter(event)) return
    event.preventDefault()
    void handleSaveField()
  }

  const handleConfirmDeleteField = async () => {
    if (!customFieldDeleteId || fieldBusy) return
    setFieldBusy(true)
    try {
      const result = await window.electronAPI.deleteAccountField(customFieldDeleteId)
      if (!result.success) throw new Error('自定义字段不存在或已经删除')
      setCustomFieldDeleteId(null)
      const refreshFailed = await refreshAccountViews({ preserveDraft: true })
      setNotice({
        severity: refreshFailed ? 'info' : 'success',
        text: refreshFailed ? '自定义字段已删除，但界面刷新失败' : '自定义字段已删除',
      })
    } catch (error) {
      setNotice({ severity: 'error', text: `删除自定义字段失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setFieldBusy(false)
    }
  }

  const toggleCustomFieldVisibility = (fieldId: string) => {
    setVisibleCustomFieldIds((ids) => ids.includes(fieldId)
      ? ids.filter((id) => id !== fieldId)
      : [...ids, fieldId])
  }

  const handleAddTag = async (tagName: string) => {
    const name = tagName.trim()
    if (!name || tagBusyRef.current) return
    tagBusyRef.current = true
    setTagBusy(`add:${name.toLocaleLowerCase()}`)
    try {
      const result = await addAccountTag(accountId, name)
      setNewTagName('')
      const detailRefreshFailed = await refreshAccountViews({ preserveDraft: true, includeLists: false })
      const refreshFailed = result.refreshFailed || detailRefreshFailed
      setNotice({
        severity: refreshFailed || result.linked === false ? 'info' : 'success',
        text: refreshFailed
          ? `标签“${name}”已处理，但界面刷新失败`
          : result.linked === false ? `当前账号已有标签“${name}”` : `已添加标签“${name}”`,
      })
    } catch (error) {
      setNotice({ severity: 'error', text: `添加标签失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      tagBusyRef.current = false
      setTagBusy(null)
    }
  }

  const handleTagQuickSubmit = (event: React.KeyboardEvent) => {
    if (tagBusy || !newTagName.trim() || !shouldSubmitOnEnter(event)) return
    event.preventDefault()
    void handleAddTag(newTagName)
  }

  const handleRemoveTag = async (tag: TagRow) => {
    if (tagBusy) return
    setTagBusy(`remove:${tag.id}`)
    try {
      const result = await removeAccountTag(accountId, tag.id)
      if (!result.success) throw new Error('标签已被移除，请刷新后重试')
      const detailRefreshFailed = await refreshAccountViews({ preserveDraft: true, includeLists: false })
      const refreshFailed = result.refreshFailed || detailRefreshFailed
      setNotice({
        severity: refreshFailed ? 'info' : 'success',
        text: refreshFailed ? `标签“${tag.name}”已移除，但界面刷新失败` : `已从当前账号移除标签“${tag.name}”`,
      })
    } catch (error) {
      setNotice({ severity: 'error', text: `移除标签失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setTagBusy(null)
    }
  }

  const handleTagContextMenu = (event: React.MouseEvent, tag: AccountTagUsageRow) => {
    event.preventDefault()
    event.stopPropagation()
    setTagContextMenu({ mouseX: event.clientX + 2, mouseY: event.clientY - 6, tag })
  }

  const handleConfirmDeleteTag = async () => {
    if (!tagDeleteTarget || tagBusy) return
    const target = tagDeleteTarget
    setTagBusy(`delete:${target.id}`)
    try {
      const result = await deleteTag(target.id)
      if (!result.success) throw new Error('标签不存在或已经删除')
      setTagDeleteTarget(null)
      const detailRefreshFailed = await refreshAccountViews({ preserveDraft: true, includeLists: false })
      const refreshFailed = result.refreshFailed || detailRefreshFailed
      setNotice({
        severity: refreshFailed ? 'info' : 'success',
        text: refreshFailed
          ? `标签“${target.name}”已删除，但界面刷新失败`
          : `已删除标签“${target.name}”，并解除 ${result.affectedAccounts} 个账号关联`,
      })
    } catch (error) {
      setNotice({ severity: 'error', text: `删除标签失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setTagBusy(null)
    }
  }

  const handleIncrementLinkedHotp = async (totpId: string) => {
    if (hotpIncrementBusyRef.current) return
    hotpIncrementBusyRef.current = true
    setHotpIncrementBusy(true)
    try {
      const result = await incrementTotpCounter(totpId)
      if (result.refreshFailed) {
        setNotice({ severity: 'info', text: 'HOTP 计数器已递增，但验证码刷新失败；重新进入后会再次读取' })
      }
    } catch (error) {
      setNotice({ severity: 'error', text: `HOTP 计数器递增失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      hotpIncrementBusyRef.current = false
      setHotpIncrementBusy(false)
    }
  }

  if (!account) {
    return (
      <Box sx={{ flex: 1, minWidth: 0, p: 2 }}>
        {accountLoadError ? (
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={() => { void loadAccount().catch(() => undefined) }}>重试</Button>}
          >
            {accountLoadError}
          </Alert>
        ) : (
          <LinearProgress aria-label="正在读取账号" />
        )}
      </Box>
    )
  }

  const linkedTotpCount = account.linked_totp_count ?? 0
  const linkedTotpSnapshot = account.linked_totp_accounts?.[0]
  const linkedTotpAccount = linkedTotpCount === 1
    ? totpAccounts.find((totpAccount) => (
        linkedTotpSnapshot
          ? totpAccount.id === linkedTotpSnapshot.id
          : totpAccount.linked_account_id === accountId
      )) || linkedTotpSnapshot
    : undefined
  const displayedTotpSecret = linkedTotpCount > 1
    ? ''
    : linkedTotpAccount?.secret || account.totp_secret
  const hasTotpSecret = Boolean(!editing && displayedTotpSecret && displayedTotpSecret.trim())
  const createdTagSuggestions = getCreatedTagSuggestions(tagCatalog, account.tags || [])
  const sectionOrder = getAccountDetailSectionOrder(hasTotpSecret)
  const pendingLinkUri = normalizeOtpInput(linkData.secret)?.parsedUri
  const linkRequiresStoredMetadata = (
    (pendingLinkUri?.otpType ?? linkData.otpType) === 'hotp'
    || (pendingLinkUri?.algorithm ?? linkData.algorithm) !== 'SHA1'
    || (pendingLinkUri?.digits ?? linkData.digits) !== 6
    || (pendingLinkUri?.period ?? linkData.period) !== 30
    || (pendingLinkUri?.counter ?? linkData.counter) !== 0
  )

  const renderAccountInfoSection = () => (
    <React.Fragment key="account-info">
      <SectionLabel>账号信息</SectionLabel>
      <Paper variant="outlined" sx={editing ? panelSx : fieldPanelSx}>
        {editing ? (
          <TextField
            select
            fullWidth
            size="small"
            label="主账号类型"
            value={editData.platform}
            onChange={(event) =>
              setEditData({ ...editData, platform: event.target.value as AccountPlatform })
            }
            sx={{ mb: 1.5 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PublicOutlinedIcon sx={{ fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
          >
            <MenuItem value="google">Google</MenuItem>
            <MenuItem value="microsoft">Microsoft</MenuItem>
            <MenuItem value="other">其他</MenuItem>
          </TextField>
        ) : (
          <Box sx={fieldBoxSx}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                color: 'primary.main',
                bgcolor: 'surface.sunken',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <PublicOutlinedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 600 }}>
                主账号类型
              </Typography>
              <PlatformChip platform={account.platform} />
            </Box>
          </Box>
        )}

        <SensitiveField icon={<PersonIcon sx={{ fontSize: 18 }} />} label="主邮箱 / 登录账号" value={editing ? editData.username : account.username} fieldKey="username" copiedField={copiedField} onCopy={copy} editing={editing} onChange={(value) => setEditData({ ...editData, username: value })} onQuickSubmit={handleAccountQuickSubmit} />
        <SensitiveField
          icon={<LockIcon sx={{ fontSize: 18 }} />}
          label="密码"
          value={editing ? editData.password : account.password}
          fieldKey="password"
          copiedField={copiedField}
          onCopy={copy}
          editing={editing}
          onChange={(value) => setEditData({ ...editData, password: value })}
          onQuickSubmit={handleAccountQuickSubmit}
          onGenerate={
            editing
              ? () => {
                    setEditData({ ...editData, password: generateSecurePassword() })
                }
              : undefined
          }
        />
        <SensitiveField icon={<PhoneIcon sx={{ fontSize: 18 }} />} label="绑定手机号" value={editing ? editData.phone : account.phone} fieldKey="phone" copiedField={copiedField} onCopy={copy} editing={editing} onChange={(value) => setEditData({ ...editData, phone: value })} onQuickSubmit={handleAccountQuickSubmit} />
        <SensitiveField icon={<EmailIcon sx={{ fontSize: 18 }} />} label="备用邮箱" value={editing ? editData.backupEmail : account.backup_email} fieldKey="backup_email" copiedField={copiedField} onCopy={copy} editing={editing} onChange={(value) => setEditData({ ...editData, backupEmail: value })} onQuickSubmit={handleAccountQuickSubmit} />
        <SensitiveField
          icon={<SecurityIcon sx={{ fontSize: 18 }} />}
          label="2FA 密钥"
          value={editing ? editData.totpSecret : account.totp_secret}
          fieldKey="totp_secret"
          copiedField={copiedField}
          onCopy={copy}
          editing={editing}
          onChange={(value) => {
            setEditData({ ...editData, totpSecret: value })
            setTotpInputError('')
          }}
          onQuickSubmit={handleAccountQuickSubmit}
          error={Boolean(totpInputError)}
          helperText={totpInputError || (editing ? '支持 Base32 密钥或 otpauth:// URI' : undefined)}
        />
      </Paper>
    </React.Fragment>
  )

  const renderRealtimeCodeSection = () => (
    <React.Fragment key="realtime-code">
      <SectionLabel>实时验证码</SectionLabel>
      <Box sx={{ mb: 2 }}>
        <TotpCodeDisplay
          secret={displayedTotpSecret}
          compact
          algorithm={linkedTotpAccount?.algorithm}
          digits={linkedTotpAccount?.digits}
          period={linkedTotpAccount?.period}
          otpType={linkedTotpAccount?.otp_type}
          counter={linkedTotpAccount?.counter}
          onIncrementCounter={linkedTotpAccount?.otp_type === 'hotp'
            ? () => { void handleIncrementLinkedHotp(linkedTotpAccount.id) }
            : undefined}
          incrementBusy={hotpIncrementBusy}
        />
      </Box>
    </React.Fragment>
  )

  const renderTagsSection = () => (
    <React.Fragment key="registered-platform-tags">
      <SectionLabel>注册平台标签</SectionLabel>
      <Paper variant="outlined" sx={panelSx}>
        {(account.tags || []).length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.85, mb: 1.65 }}>
            {(account.tags || []).map((tag) => {
              const catalogTag = tagCatalog.find((candidate) => candidate.id === tag.id) || {
                ...tag,
                usage_count: 1,
              }
              return (
                <Tooltip key={tag.id} title={`点击 × 从当前账号移除“${tag.name}”；右键管理标签`} arrow>
                  <Chip
                    label={tag.name}
                    aria-label={`从当前账号移除标签 ${tag.name}`}
                    disabled={Boolean(tagBusy)}
                    onContextMenu={(event) => handleTagContextMenu(event, catalogTag)}
                    onDelete={() => handleRemoveTag(tag)}
                    sx={{
                      maxWidth: '100%',
                      bgcolor: `${tag.color}22`,
                      color: tag.color,
                      border: '1px solid',
                      borderColor: `${tag.color}55`,
                      '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                      '& .MuiChip-deleteIcon': { color: 'inherit' },
                    }}
                  />
                </Tooltip>
              )
            })}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 1.65, lineHeight: 1.5 }}>
            还没有记录这个主账号注册过的平台。
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1.1, alignItems: 'stretch', mb: createdTagSuggestions.length > 0 ? 1.85 : 0 }}>
          <TextField
            fullWidth
            size="small"
            label="添加平台标签"
            placeholder="例如 GitHub、Discord、Notion"
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            onKeyDown={handleTagQuickSubmit}
            inputProps={{ maxLength: MAX_ACCOUNT_TAG_LENGTH }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LabelOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                height: ACCOUNT_TAG_INPUT_CONTROL_HEIGHT,
              },
            }}
          />
          <Button
            variant="contained"
            disabled={!newTagName.trim() || Boolean(tagBusy)}
            onClick={() => void handleAddTag(newTagName)}
            sx={{
              height: ACCOUNT_TAG_INPUT_CONTROL_HEIGHT,
              minWidth: 84,
              flexShrink: 0,
            }}
          >
            添加
          </Button>
        </Box>

        {createdTagSuggestions.length > 0 && (
          <>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.2, lineHeight: 1.45, fontSize: '0.75rem', fontWeight: 600 }}>
              已创建标签（{createdTagSuggestions.length}）
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.95, maxHeight: 168, overflowY: 'auto', pr: 0.5 }}>
              {createdTagSuggestions.map((tag) => (
                <Tooltip key={tag.id} title="单击添加；右键管理标签" arrow>
                  <Chip
                    label={tag.name}
                    variant="outlined"
                    disabled={Boolean(tagBusy)}
                    onClick={() => void handleAddTag(tag.name)}
                    onContextMenu={(event) => handleTagContextMenu(event, tag)}
                    sx={{
                      height: 28,
                      maxWidth: '100%',
                      fontWeight: 700,
                      '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </>
        )}
      </Paper>
    </React.Fragment>
  )

  const renderCustomFieldsSection = () => (
    <React.Fragment key="custom-fields">
      <SectionLabel
        action={!editing ? (
          <Tooltip title="添加自定义字段">
            <span>
              <IconButton
                size="small"
                aria-label="添加自定义字段"
                onClick={openAddCustomField}
                disabled={fieldBusy}
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
              >
                <AddCircleOutlineIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        ) : undefined}
      >
        自定义字段
      </SectionLabel>

      {customFields.length > 0 && (
        <Paper variant="outlined" sx={fieldPanelSx}>
          {customFields.map((field) => (
            <Box
              key={field.id}
              sx={{
                ...fieldBoxSx,
                borderColor: copiedField === field.id ? 'success.main' : 'border.subtle',
                bgcolor: copiedField === field.id ? 'rgba(52, 168, 83, 0.12)' : 'transparent',
                boxShadow: copiedField === field.id ? 'inset 0 0 0 1px rgba(52, 168, 83, 0.75)' : 'none',
                transition: 'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
                '&:hover': {
                  bgcolor: copiedField === field.id ? 'rgba(52, 168, 83, 0.16)' : 'action.hover',
                },
                '&:hover .cf-actions': { opacity: 1 },
              }}
            >
              <Box
                component="button"
                type="button"
                disabled={fieldBusy}
                aria-label={`复制${field.field_name}`}
                onClick={() => { void copy(field.field_value, field.id) }}
                sx={{
                  all: 'unset',
                  flex: 1,
                  minWidth: 0,
                  alignSelf: 'stretch',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  cursor: fieldBusy ? 'default' : 'pointer',
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: copiedField === field.id ? 'success.main' : 'primary.main',
                    outlineOffset: 2,
                  },
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 600 }}>
                  {field.field_name} {field.is_secret ? '敏感' : ''}
                </Typography>
                <Typography
                  variant="body2"
                  className={field.is_secret ? 'mono-data' : undefined}
                  sx={{ color: 'text.primary', mt: 0.2, fontWeight: 600 }}
                  noWrap
                >
                  {field.is_secret && !visibleCustomFieldIds.includes(field.id)
                    ? '••••••••'
                    : field.field_value || '(空)'}
                </Typography>
              </Box>
              <Box className="cf-actions" sx={{ display: 'flex', gap: 0.35, opacity: 0.82, transition: 'opacity 0.15s' }}>
                  {Boolean(field.is_secret) && (
                    <Tooltip title={visibleCustomFieldIds.includes(field.id) ? '隐藏' : '显示'}>
                    <IconButton
                      size="small"
                      aria-label={visibleCustomFieldIds.includes(field.id) ? `隐藏${field.field_name}` : `显示${field.field_name}`}
                      disabled={fieldBusy}
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleCustomFieldVisibility(field.id)
                      }}
                      sx={{ color: 'text.secondary' }}
                    >
                        {visibleCustomFieldIds.includes(field.id)
                          ? <VisibilityOffIcon sx={{ fontSize: 14 }} />
                          : <VisibilityIcon sx={{ fontSize: 14 }} />}
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={copiedField === field.id ? '已复制' : `复制${field.field_name}`}>
                    <IconButton
                      size="small"
                      aria-label={`复制${field.field_name}`}
                      disabled={fieldBusy}
                      onClick={(event) => {
                        event.stopPropagation()
                        void copy(field.field_value, field.id)
                      }}
                      sx={{ color: copiedField === field.id ? 'success.main' : 'text.secondary' }}
                    >
                      {copiedField === field.id ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={`编辑${field.field_name}`}>
                    <IconButton
                      size="small"
                      aria-label={`编辑${field.field_name}`}
                      disabled={fieldBusy}
                      onClick={(event) => {
                        event.stopPropagation()
                        openEditCustomField(field)
                      }}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                    >
                      <EditIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={`删除${field.field_name}`}>
                    <IconButton
                      size="small"
                      aria-label={`删除${field.field_name}`}
                      disabled={fieldBusy}
                      onClick={(event) => {
                        event.stopPropagation()
                        setCustomFieldDeleteId(field.id)
                      }}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
              </Box>
            </Box>
          ))}
        </Paper>
      )}

      {showAddField && (
        <Paper variant="outlined" sx={panelSx}>
          <TextField
            fullWidth
            size="small"
            label="字段名称"
            value={newFieldName}
            onChange={(event) => setNewFieldName(event.target.value)}
            onKeyDown={handleCustomFieldQuickSubmit}
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth
            size="small"
            label="字段值"
            value={newFieldValue}
            onChange={(event) => setNewFieldValue(event.target.value)}
            type={newFieldIsSecret && !newFieldValueVisible ? 'password' : 'text'}
            multiline={!newFieldIsSecret}
            minRows={newFieldIsSecret ? undefined : 2}
            onKeyDown={handleCustomFieldQuickSubmit}
            InputProps={{
              endAdornment: newFieldIsSecret ? (
                <InputAdornment position="end">
                  <Tooltip title={newFieldValueVisible ? '隐藏敏感值' : '显示敏感值'}>
                    <IconButton
                      size="small"
                      aria-label={newFieldValueVisible ? '隐藏字段值' : '显示字段值'}
                      onClick={() => setNewFieldValueVisible((current) => !current)}
                      edge="end"
                    >
                      {newFieldValueVisible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ) : undefined,
            }}
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
            <Chip
              label={newFieldIsSecret ? '🔒 加密字段' : '📝 普通字段'}
              size="small"
              onClick={() => {
                setNewFieldIsSecret(!newFieldIsSecret)
                setNewFieldValueVisible(false)
              }}
              disabled={fieldBusy}
              variant="outlined"
              color={newFieldIsSecret ? 'warning' : 'default'}
            />
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={resetCustomFieldEditor} disabled={fieldBusy}>
              取消
            </Button>
            <Button size="small" variant="contained" onClick={handleSaveField} disabled={!newFieldName.trim() || fieldBusy}>
              {fieldBusy ? '保存中...' : editingCustomField ? '保存' : '添加'}
            </Button>
          </Box>
        </Paper>
      )}
    </React.Fragment>
  )

  const renderNotesSection = () => (
    <React.Fragment key="notes">
      <SectionLabel>备注</SectionLabel>
      {editing ? (
        <TextField
          fullWidth
          multiline
          minRows={4}
          maxRows={12}
          value={editData.notes}
          onChange={(event) => setEditData({ ...editData, notes: event.target.value })}
          placeholder="记录恢复邮箱、用途说明、购买来源等..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.25 }}>
                <NoteIcon sx={{ fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiInputBase-root': { fontSize: '0.95rem', lineHeight: 1.7 },
            '& .MuiOutlinedInput-root': { borderRadius: 1, bgcolor: 'surface.raised' },
          }}
        />
      ) : account.notes ? (
        <Paper
          variant="outlined"
          sx={{ ...panelSx, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
          onClick={() => setNotesExpanded(!notesExpanded)}
        >
          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'pre-wrap',
              fontSize: '0.95rem',
              lineHeight: 1.72,
              color: 'text.primary',
              maxHeight: notesExpanded ? 'none' : 120,
              overflow: 'hidden',
            }}
          >
            {account.notes}
          </Typography>
          {!notesExpanded && account.notes.length > 200 && (
            <Typography variant="caption" sx={{ color: 'primary.main', mt: 0.5, display: 'block' }}>
              点击展开全部
            </Typography>
          )}
        </Paper>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', lineHeight: 1.5, fontStyle: 'italic' }}>
          暂无备注
        </Typography>
      )}
    </React.Fragment>
  )

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          minHeight: 68,
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
          flexShrink: 0,
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'surface.raised',
            border: '1px solid',
            borderColor: 'border.subtle',
            color: 'primary.main',
            flexShrink: 0,
          }}
        >
          <AccountBoxIcon sx={{ fontSize: 21 }} />
        </Box>
        {editing ? (
          <TextField
            size="small"
            value={editData.name}
            onChange={(event) => setEditData({ ...editData, name: event.target.value })}
            onKeyDown={handleAccountQuickSubmit}
            sx={{ flex: 1, minWidth: 0 }}
            variant="standard"
            inputProps={{ 'aria-label': '账号名称', style: { fontSize: '1rem', fontWeight: 600 } }}
          />
        ) : (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.65, minWidth: 0 }}>
              <Typography variant="h6" sx={{ flex: 1, minWidth: 0, fontSize: '1.05rem' }} noWrap>
                {account.name}
              </Typography>
              <PlatformChip platform={account.platform} />
              {account.totp_secret && account.totp_secret.trim() && (
                <Chip size="small" label="2FA" variant="outlined" sx={{ height: 24, color: 'success.main', borderColor: 'success.main' }} />
              )}
            </Box>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.25 }} noWrap>
              {account.username || '未设置主邮箱 / 登录账号'}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
          {editing ? (
            <>
              <Tooltip title="保存修改">
                <span>
                  <IconButton
                    size="small"
                    aria-label="保存账号修改"
                    onClick={handleSave}
                    disabled={saveBusy || !editData.name.trim() || !hasUnsavedAccountChanges}
                    sx={{ color: 'success.main' }}
                  >
                    <SaveIcon sx={{ fontSize: 19 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="取消编辑">
                <span>
                  <IconButton size="small" aria-label="取消编辑账号" onClick={handleCancelEdit} disabled={saveBusy} sx={{ color: 'text.secondary' }}>
                    <CloseIcon sx={{ fontSize: 19 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip title={isPinned ? "取消置顶" : "置顶主账号"} arrow TransitionComponent={Fade}>
                <IconButton
                  size="small"
                  aria-label={isPinned ? '取消置顶主账号' : '置顶主账号'}
                  onClick={onTogglePin}
                  sx={{ color: isPinned ? 'primary.main' : 'text.secondary' }}
                >
                  {isPinned ? <PushPinIcon sx={{ fontSize: 19 }} /> : <PushPinOutlinedIcon sx={{ fontSize: 19 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="编辑账号">
                <IconButton size="small" aria-label="编辑账号" onClick={() => setEditing(true)} sx={{ color: 'text.secondary' }}>
                  <EditIcon sx={{ fontSize: 19 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="移入回收站">
                <IconButton
                  size="small"
                  aria-label="将账号移入回收站"
                  onClick={() => setDeleteConfirmOpen(true)}
                  sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 19 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', px: 2.25, py: 2 }}>
        {accountLoadError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={<Button color="inherit" size="small" onClick={() => { void loadAccount({ preserveDraft: editing }).catch(() => undefined) }}>重试</Button>}
          >
            {accountLoadError}
          </Alert>
        )}
        {linkedTotpCount > 1 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            检测到 {linkedTotpCount} 条关联 2FA。为避免覆盖密钥，修改 2FA 前请先到 2FA 面板确认要保留的记录；系统不会自动删除。
          </Alert>
        )}
        {sectionOrder.map((section) => {
          switch (section) {
            case 'realtime-code':
              return renderRealtimeCodeSection()
            case 'account-info':
              return renderAccountInfoSection()
            case 'registered-platform-tags':
              return renderTagsSection()
            case 'custom-fields':
              return renderCustomFieldsSection()
            case 'notes':
              return renderNotesSection()
            default:
              return null
          }
        })}
      </Box>

      <Menu
        open={tagContextMenu !== null}
        onClose={() => setTagContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={tagContextMenu
          ? { top: tagContextMenu.mouseY, left: tagContextMenu.mouseX }
          : undefined}
      >
        <MenuItem
          disabled={Boolean(tagBusy)}
          onClick={() => {
            if (tagContextMenu) setTagDeleteTarget(tagContextMenu.tag)
            setTagContextMenu(null)
          }}
        >
          <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>删除标签</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog
        open={tagDeleteTarget !== null}
        onClose={() => { if (!tagBusy) setTagDeleteTarget(null) }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          删除标签
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            确定要彻底删除标签 <strong>{tagDeleteTarget?.name}</strong> 吗？
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary', fontSize: '0.82rem', lineHeight: 1.55 }}>
            将从 {tagDeleteTarget?.usage_count ?? 0} 个关联账号中移除该标签。账号、密码、2FA 和其他字段都不会被删除；此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagDeleteTarget(null)} disabled={Boolean(tagBusy)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDeleteTag} disabled={Boolean(tagBusy)}>
            {tagBusy?.startsWith('delete:') ? '删除中...' : '删除标签'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onClose={() => { if (!deleteBusy) setDeleteConfirmOpen(false) }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          移入回收站
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">确定要把 <strong>{account.name}</strong> 移入回收站吗？</Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary', fontSize: '0.82rem' }}>
            账号可以在回收站中恢复；彻底删除时，关联的 2FA 将转为孤立提醒状态。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleteBusy}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteBusy}>
            {deleteBusy ? '处理中...' : '移入回收站'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={linkTotpDialogOpen}
        onClose={handleCancelLink}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          component: 'form',
          onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (!linkBusy && pendingLinkPatch) void handleConfirmLink()
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon sx={{ color: 'primary.main' }} />
          绑定 2FA 记录
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, mt: 1 }}>
            是否在 2FA 面板中创建并绑定对应卡片？账号与卡片会作为一次完整操作保存。
          </Typography>
          {linkRequiresStoredMetadata && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              该密钥使用 HOTP 或非默认参数，必须绑定卡片才能保留完整参数并生成正确验证码。
            </Alert>
          )}
          <TextField
            fullWidth
            size="small"
            label="服务商"
            value={linkData.issuer}
            onChange={(event) => setLinkData({ ...linkData, issuer: event.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label="账户名称"
            value={linkData.label}
            onChange={(event) => setLinkData({ ...linkData, label: event.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            size="small"
            label="密钥"
            value={linkData.secret}
            type={linkSecretVisible ? 'text' : 'password'}
            onChange={(event) => setLinkData({ ...linkData, secret: event.target.value })}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={linkSecretVisible ? '隐藏密钥' : '显示密钥'}>
                    <IconButton
                      type="button"
                      size="small"
                      aria-label={linkSecretVisible ? '隐藏 2FA 密钥' : '显示 2FA 密钥'}
                      onClick={() => setLinkSecretVisible((current) => !current)}
                      edge="end"
                    >
                      {linkSecretVisible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCancelLink} disabled={linkBusy}>取消保存</Button>
          <Tooltip title={linkRequiresStoredMetadata ? '当前密钥需要保存完整验证参数' : ''}>
            <span>
              <Button type="button" onClick={handleSkipLink} disabled={linkBusy || linkRequiresStoredMetadata}>仅保存密钥</Button>
            </span>
          </Tooltip>
          <Button type="submit" variant="contained" disabled={linkBusy}>
            {linkBusy ? '绑定中...' : '绑定到 2FA 面板'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={customFieldDeleteId !== null} onClose={() => { if (!fieldBusy) setCustomFieldDeleteId(null) }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          删除自定义字段
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">确定删除这个自定义字段吗？该操作无法撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomFieldDeleteId(null)} disabled={fieldBusy}>取消</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDeleteField} disabled={fieldBusy}>
            {fieldBusy ? '删除中...' : '删除'}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={notice !== null} autoHideDuration={4500} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={notice?.severity || 'info'} variant="filled" onClose={() => setNotice(null)} sx={{ width: '100%' }}>
          {notice?.text}
        </Alert>
      </Snackbar>
    </Box>
  )
}

type PendingAccountAction =
  | { kind: 'select'; accountId: string | null; edit: boolean }
  | { kind: 'create'; platform: AccountPlatform }
  | { kind: 'delete'; accountId: string }

export default function AccountsView() {
  const {
    accountPlatformFilter,
    accountSearchQuery,
    accounts,
    allAccounts,
    createAccount,
    deleteAccount,
    importCsvAccounts,
    loadAccounts,
    loadAllAccounts,
    loadTotpAccounts,
    navigationBlockReason,
    selectedAccountId,
    setAccountPlatformFilter,
    setAccountSearchQuery,
    setNavigationBlockReason,
    setSelectedAccount,
    accountsPinnedIds,
    accountsCustomOrder,
    togglePinAccount,
    updateAccountsCustomOrder,
  } = useStore()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; accountId: string } | null>(null)
  const [listDeleteConfirm, setListDeleteConfirm] = useState<string | null>(null)
  const [editSignal, setEditSignal] = useState(0)
  const [platformDialogOpen, setPlatformDialogOpen] = useState(false)
  const [pendingAccountAction, setPendingAccountAction] = useState<PendingAccountAction | null>(null)
  const [notice, setNotice] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [createBusy, setCreateBusy] = useState(false)
  const [listDeleteBusy, setListDeleteBusy] = useState(false)
  const [listLoadState, setListLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [listLoadError, setListLoadError] = useState('')
  const { copiedKey: copiedField, copy } = useCopyFeedback()

  // Drag and drop states for custom account ordering
  const [draggedId, setDraggedId] = useState<string | null>(null)

  // List container custom width states
  const compactViewport = useMediaQuery('(max-width:1080px)')
  const [listWidth, setListWidth] = useState(300)
  const renderedListWidth = compactViewport ? 280 : listWidth

  useEffect(() => {
    let mounted = true
    window.electronAPI.getAppPreferences().then((preferences) => {
      if (!mounted) return
      let savedWidth = preferences.accountsListWidth
      if (typeof savedWidth !== 'number') {
        const legacyWidthValue = localStorage.getItem('accounts_list_width')
        const legacyWidth = legacyWidthValue === null ? Number.NaN : Number(legacyWidthValue)
        if (Number.isFinite(legacyWidth)) {
          savedWidth = Math.max(280, Math.min(420, legacyWidth))
          void window.electronAPI.updateAppPreferences({ accountsListWidth: savedWidth })
          localStorage.removeItem('accounts_list_width')
        }
      }
      if (typeof savedWidth === 'number') {
        const normalizedWidth = Math.max(280, Math.min(420, savedWidth))
        setListWidth(normalizedWidth)
        if (normalizedWidth !== savedWidth) {
          void window.electronAPI.updateAppPreferences({ accountsListWidth: normalizedWidth })
        }
      }
    }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  const handleListResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = listWidth
    let latestWidth = startWidth

    const doDrag = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(280, Math.min(420, startWidth + (moveEvent.clientX - startX)))
      latestWidth = newWidth
      setListWidth(newWidth)
    }

    const stopDrag = () => {
      window.removeEventListener('mousemove', doDrag)
      window.removeEventListener('mouseup', stopDrag)
      void window.electronAPI.updateAppPreferences({ accountsListWidth: latestWidth })
    }

    window.addEventListener('mousemove', doDrag)
    window.addEventListener('mouseup', stopDrag)
  }

  // Sort accounts list locally: 1. Pinned accounts first, 2. customOrder sequence
  const sortedAccounts = [...accounts].sort((a, b) => {
    const aPinned = accountsPinnedIds.includes(a.id)
    const bPinned = accountsPinnedIds.includes(b.id)
    
    if (aPinned && !bPinned) return -1
    if (!aPinned && bPinned) return 1

    const aIndex = accountsCustomOrder.indexOf(a.id)
    const bIndex = accountsCustomOrder.indexOf(b.id)
    const aHas = aIndex !== -1
    const bHas = bIndex !== -1
    if (aHas && bHas) return aIndex - bIndex
    if (aHas && !bHas) return -1
    if (!aHas && bHas) return 1
    return 0
  })

  // DND event handlers for main accounts
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) return

    const currentIds = sortedAccounts.map(a => a.id)
    const draggedIndex = currentIds.indexOf(draggedId)
    const targetIndex = currentIds.indexOf(targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newSortedIds = [...currentIds]
    const [removed] = newSortedIds.splice(draggedIndex, 1)
    newSortedIds.splice(targetIndex, 0, removed)

    // Save configuration sequence to global store
    updateAccountsCustomOrder(mergeVisibleAccountOrder(
      accountsCustomOrder,
      allAccounts.map((account) => account.id),
      newSortedIds
    ))

    setDraggedId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
  }

  const loadAccountLists = async () => {
    setListLoadState('loading')
    setListLoadError('')
    try {
      await Promise.all([loadAccounts(), loadAllAccounts(), loadTotpAccounts()])
      setListLoadState('ready')
    } catch (error) {
      setListLoadError(`读取账号列表失败：${error instanceof Error ? error.message : String(error)}`)
      setListLoadState('error')
    }
  }

  useEffect(() => {
    void loadAccountLists()
  }, [accountPlatformFilter, accountSearchQuery])

  const selectAccount = (accountId: string | null, edit = false) => {
    setSelectedAccount(accountId)
    if (edit && accountId) {
      setEditSignal(Date.now())
    }
  }

  const requestAccountSelection = (accountId: string | null, edit = false) => {
    if (accountId === selectedAccountId) {
      if (edit && accountId) setEditSignal(Date.now())
      return
    }
    if (navigationBlockReason) {
      setPendingAccountAction({ kind: 'select', accountId, edit })
      return
    }
    selectAccount(accountId, edit)
  }

  const createAccountForPlatform = async (platform: AccountPlatform) => {
    if (createBusy) return
    const defaultName = platform === 'google'
      ? 'Google 账号'
      : platform === 'microsoft'
        ? 'Microsoft 账号'
        : '新账号'
    setCreateBusy(true)
    try {
      const result = await createAccount(defaultName, platform)
      const { id } = result
      setSelectedAccount(id)
      setEditSignal(Date.now())
      setPlatformDialogOpen(false)
      if (result.refreshFailed) {
        setNotice({ severity: 'info', text: '账号已创建，但部分列表刷新失败；账号详情会直接读取已保存记录' })
      } else {
        setListLoadState('ready')
        setListLoadError('')
      }
    } catch (error) {
      setNotice({ severity: 'error', text: `创建账号失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setCreateBusy(false)
    }
  }

  const handleCreate = async (platform: AccountPlatform) => {
    if (navigationBlockReason) {
      setPlatformDialogOpen(false)
      setPendingAccountAction({ kind: 'create', platform })
      return
    }
    await createAccountForPlatform(platform)
  }

  const discardAndContinue = async () => {
    const action = pendingAccountAction
    if (!action) return
    setPendingAccountAction(null)
    setNavigationBlockReason(null)

    if (action.kind === 'create') {
      await createAccountForPlatform(action.platform)
      return
    }
    if (action.kind === 'delete') {
      setSelectedAccount(null)
      setListDeleteConfirm(action.accountId)
      return
    }
    selectAccount(action.accountId, action.edit)
  }

  const handleImportCsv = async () => {
    try {
      const result = await importCsvAccounts()
      if (result.count > 0 && !result.refreshFailed) {
        setListLoadState('ready')
        setListLoadError('')
      }
      const warnings = [
        result.invalidTotpCount > 0 ? `${result.invalidTotpCount} 个无效 OTP URI 已跳过` : '',
        result.skippedRowCount > 0 ? `${result.skippedRowCount} 行没有可识别字段` : '',
        result.refreshFailed ? '数据已导入，但部分列表刷新失败' : '',
      ].filter(Boolean)
      setNotice(result.count > 0
        ? {
            severity: warnings.length > 0 ? 'info' : 'success',
            text: `已导入 ${result.count} 个账号${warnings.length > 0 ? `；${warnings.join('；')}` : ''}`,
          }
        : {
            severity: 'info',
            text: warnings.length > 0
              ? `未导入账号：${warnings.join('；')}`
              : '未导入账号：已取消选择或文件中没有有效记录',
          })
    } catch (error) {
      setNotice({ severity: 'error', text: `CSV 导入失败：${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const handleContextMenu = (event: React.MouseEvent, id: string) => {
    event.preventDefault()
    setContextMenu(
      contextMenu === null
        ? { mouseX: event.clientX + 2, mouseY: event.clientY - 6, accountId: id }
        : null
    )
  }

  const handleQuickEdit = () => {
    if (contextMenu) {
      requestAccountSelection(contextMenu.accountId, true)
    }
    setContextMenu(null)
  }

  const handleDeleteFromList = async () => {
    if (listDeleteConfirm && !listDeleteBusy) {
      setListDeleteBusy(true)
      try {
        const result = await deleteAccount(listDeleteConfirm)
        setListDeleteConfirm(null)
        setNotice({
          severity: result.refreshFailed ? 'info' : 'success',
          text: result.refreshFailed ? '账号已移入回收站，但部分列表刷新失败' : '账号已移入回收站',
        })
      } catch (error) {
        setNotice({ severity: 'error', text: `移入回收站失败：${error instanceof Error ? error.message : String(error)}` })
      } finally {
        setListDeleteBusy(false)
      }
    }
  }

  const requestDeleteFromList = (accountId: string) => {
    if (navigationBlockReason && accountId === selectedAccountId) {
      setPendingAccountAction({ kind: 'delete', accountId })
      return
    }
    setListDeleteConfirm(accountId)
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', bgcolor: 'background.default' }}>
      <Box
        sx={{
          width: renderedListWidth,
          minWidth: renderedListWidth,
          borderRight: '1px solid',
          borderColor: 'border.subtle',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          bgcolor: 'surface.sunken',
        }}
      >
        <PageHeader
          compact
          title="主账号"
          description={`${accounts.length} 个账号`}
          actions={(
            <>
              <Tooltip title="导入 CSV" arrow>
                <IconButton size="small" aria-label="导入账号 CSV" onClick={handleImportCsv}>
                  <FileUploadOutlinedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="新建主账号" arrow>
                <IconButton size="small" aria-label="新建主账号" onClick={() => setPlatformDialogOpen(true)} sx={{ color: 'primary.main' }}>
                  <AddIcon sx={{ fontSize: 19 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
        />

        <Box sx={{ p: 1.25, borderBottom: '1px solid', borderColor: 'border.subtle', flexShrink: 0 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="搜索主账号..."
            value={accountSearchQuery}
            disabled={Boolean(navigationBlockReason)}
            onChange={(event) => setAccountSearchQuery(event.target.value)}
            inputProps={{ 'aria-label': '搜索主账号' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.9, overflowX: 'auto', pb: 0.1 }}>
            {([
              ['all', '全部'],
              ['google', 'Google'],
              ['microsoft', 'Microsoft'],
              ['other', '其他'],
            ] as Array<[AccountPlatform | 'all', string]>).map(([value, label]) => (
              <Chip
                key={value}
                label={label}
                variant={accountPlatformFilter === value ? 'filled' : 'outlined'}
                color={accountPlatformFilter === value ? 'primary' : 'default'}
                aria-pressed={accountPlatformFilter === value}
                disabled={Boolean(navigationBlockReason)}
                onClick={() => setAccountPlatformFilter(value)}
                sx={{ height: 24, flexShrink: 0 }}
              />
            ))}
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 0.75 }}>
          {listLoadState === 'loading' ? (
            <LinearProgress aria-label="正在读取账号列表" />
          ) : listLoadState === 'error' ? (
            <Alert
              severity="error"
              action={<Button color="inherit" size="small" onClick={() => { void loadAccountLists() }}>重试</Button>}
            >
              {listLoadError}
            </Alert>
          ) : accounts.length === 0 ? (
            <EmptyState
              compact
              icon={<AccountBoxIcon sx={{ fontSize: 20 }} />}
              title="没有符合条件的主账号"
              description="调整搜索或筛选条件，或者创建一个新账号。"
              action={(
                <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setPlatformDialogOpen(true)}>
                  添加账号
                </Button>
              )}
            />
          ) : (
            sortedAccounts.map((account) => (
              <Box
                key={account.id}
                draggable
                onDragStart={(e) => handleDragStart(e, account.id)}
                onDragOver={(e) => handleDragOver(e, account.id)}
                onDrop={(e) => handleDrop(e, account.id)}
                onDragEnd={handleDragEnd}
                onContextMenu={(event) => handleContextMenu(event, account.id)}
                onMouseEnter={() => setHoveredId(account.id)}
                onMouseLeave={() => setHoveredId(null)}
                sx={{
                  px: 1.1,
                  py: 1,
                  mb: 0.5,
                  cursor: 'grab',
                  border: '1px solid',
                  borderColor: selectedAccountId === account.id ? 'border.strong' : 'transparent',
                  borderLeft: '2px solid',
                  borderLeftColor: selectedAccountId === account.id
                    ? 'primary.main'
                    : accountsPinnedIds.includes(account.id)
                      ? 'secondary.main'
                      : 'transparent',
                  borderRadius: 1,
                  bgcolor: selectedAccountId === account.id
                    ? 'action.selected'
                    : 'transparent',
                  opacity: draggedId === account.id ? 0.35 : 1,
                  transform: draggedId === account.id ? 'scale(0.98)' : 'scale(1)',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease, opacity 0.15s ease',
                  '&:active': { cursor: 'grabbing' },
                  '&:hover': {
                    bgcolor: selectedAccountId === account.id ? 'action.selected' : 'action.hover',
                    borderColor: draggedId && draggedId !== account.id ? 'primary.main' : 'border.subtle',
                    borderLeftColor: selectedAccountId === account.id ? 'primary.main' : accountsPinnedIds.includes(account.id) ? 'secondary.main' : 'border.subtle',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Box
                    component="button"
                    type="button"
                    aria-current={selectedAccountId === account.id ? 'true' : undefined}
                    aria-label={`打开账号 ${account.name}`}
                    onClick={() => requestAccountSelection(account.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      flex: 1,
                      minWidth: 0,
                      p: 0,
                      border: 0,
                      bgcolor: 'transparent',
                      color: 'inherit',
                      textAlign: 'left',
                      cursor: 'inherit',
                    }}
                  >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      bgcolor: `${PLATFORM_ACCENTS[account.platform]}22`,
                      color: PLATFORM_ACCENTS[account.platform],
                      border: '1px solid',
                      borderColor: `${PLATFORM_ACCENTS[account.platform]}55`,
                    }}
                  >
                    <AccountBoxIcon sx={{ fontSize: 19 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55, mb: 0.25 }}>
                      <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {account.name}
                      </Typography>
                      <PlatformChip platform={account.platform} />
                    </Box>

                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                      {account.username || '未设置主邮箱 / 登录账号'}
                    </Typography>

                    {(account.tags || []).length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, mt: 0.65, maxHeight: 22, overflow: 'hidden' }}>
                        {getVisibleAccountPreviewTags(account.tags || []).map((tag) => (
                          <Chip
                            key={tag.id}
                            label={tag.name}
                            size="small"
                            sx={{
                              height: 21,
                              fontSize: '0.68rem',
                              bgcolor: `${tag.color}22`,
                              color: tag.color,
                              border: '1px solid',
                              borderColor: `${tag.color}55`,
                            }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                    <Tooltip title={accountsPinnedIds.includes(account.id) ? "取消置顶" : "置顶主账号"} arrow TransitionComponent={Fade}>
                      <IconButton
                        size="small"
                        aria-label={accountsPinnedIds.includes(account.id) ? `取消置顶 ${account.name}` : `置顶 ${account.name}`}
                        onClick={(event) => { event.stopPropagation(); togglePinAccount(account.id) }}
                        sx={{
                          color: accountsPinnedIds.includes(account.id) ? 'primary.main' : 'text.secondary',
                          opacity: accountsPinnedIds.includes(account.id) ? 1 : (hoveredId === account.id ? 0.9 : 0.55),
                          transition: 'opacity 0.15s',
                          '&:hover': { color: 'primary.main', opacity: 1 }
                        }}
                      >
                        {accountsPinnedIds.includes(account.id) ? <PushPinIcon sx={{ fontSize: 16 }} /> : <PushPinOutlinedIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </Tooltip>

                    {account.totp_secret && account.totp_secret.trim() && (
                      <Tooltip title="已启用 2FA" arrow>
                        <ShieldIcon sx={{ fontSize: 16, color: 'success.main' }} />
                      </Tooltip>
                    )}
                    {hoveredId === account.id && account.password && (
                      <Tooltip title={copiedField === `pwd-${account.id}` ? '已复制!' : '复制密码'} arrow TransitionComponent={Fade}>
                        <IconButton
                          size="small"
                          aria-label={`复制 ${account.name} 的密码`}
                          onClick={(event) => {
                            event.stopPropagation()
                            void copy(account.password, `pwd-${account.id}`)
                          }}
                          sx={{
                            color: copiedField === `pwd-${account.id}` ? 'success.main' : 'text.secondary',
                            bgcolor: copiedField === `pwd-${account.id}` ? 'rgba(52, 168, 83, 0.12)' : 'transparent',
                            boxShadow: copiedField === `pwd-${account.id}` ? 'inset 0 0 0 1px rgba(52, 168, 83, 0.7)' : 'none',
                          }}
                        >
                          {copiedField === `pwd-${account.id}` ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Box>

      {!compactViewport && (
        <Box
          role="separator"
          aria-orientation="vertical"
          aria-label="调整账号列表宽度"
          onMouseDown={handleListResizeStart}
          sx={{
            width: 5,
            cursor: 'col-resize',
            bgcolor: 'transparent',
            transition: 'background-color 0.16s ease',
            position: 'relative',
            zIndex: 10,
            '&:hover': {
              bgcolor: 'primary.main',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '-4px',
              right: '-4px',
              bottom: 0,
            },
          }}
        />
      )}

      {selectedAccountId ? (
        <AccountDetail
          key={selectedAccountId}
          accountId={selectedAccountId}
          onClose={() => requestAccountSelection(null)}
          editSignal={editSignal}
          isPinned={accountsPinnedIds.includes(selectedAccountId)}
          onTogglePin={(e) => { e.stopPropagation(); togglePinAccount(selectedAccountId) }}
          onNotice={setNotice}
        />
      ) : (
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <EmptyState
            icon={<LockIcon sx={{ fontSize: 22 }} />}
            title="选择或创建一个主账号"
            description="管理 Google / Microsoft 账号、2FA 密钥和注册平台标签。"
            action={(
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setPlatformDialogOpen(true)}>
                添加主账号
              </Button>
            )}
          />
        </Box>
      )}

      <Menu
        open={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleQuickEdit}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>快速设置</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          if (contextMenu?.accountId) requestDeleteFromList(contextMenu.accountId)
          setContextMenu(null)
        }}>
          <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>移入回收站</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={listDeleteConfirm !== null} onClose={() => { if (!listDeleteBusy) setListDeleteConfirm(null) }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          移入回收站
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">确定要把该账号移入回收站吗？</Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary', fontSize: '0.82rem' }}>
            后续仍可在回收站中恢复；彻底删除时，关联 2FA 会变为孤立提醒状态。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setListDeleteConfirm(null)} disabled={listDeleteBusy}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDeleteFromList} disabled={listDeleteBusy}>
            {listDeleteBusy ? '处理中...' : '移入回收站'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pendingAccountAction !== null} onClose={() => setPendingAccountAction(null)} maxWidth="xs" fullWidth>
        <DialogTitle>放弃未保存修改？</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {navigationBlockReason || '当前账号修改尚未保存'}。继续操作会丢失这些修改。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingAccountAction(null)}>继续编辑</Button>
          <Button color="error" variant="contained" onClick={() => void discardAndContinue()}>
            放弃并继续
          </Button>
        </DialogActions>
      </Dialog>

      <AccountPlatformDialog
        open={platformDialogOpen}
        onClose={() => setPlatformDialogOpen(false)}
        onSelect={handleCreate}
        busy={createBusy}
      />
      <Snackbar open={notice !== null} autoHideDuration={4500} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={notice?.severity || 'info'} variant="filled" onClose={() => setNotice(null)} sx={{ width: '100%' }}>
          {notice?.text}
        </Alert>
      </Snackbar>
    </Box>
  )
}
