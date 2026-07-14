import React, { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fade,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
  Alert,
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
import { useStore } from '../stores/useStore'
import { AccountRow, CustomFieldRow, TagRow } from '../types'
import {
  AccountPlatform,
  getAccountPlatformLabel,
} from '../utils/accountPlatform'
import {
  ACCOUNT_TAG_INPUT_CONTROL_HEIGHT,
  getAccountDetailSectionOrder,
  getVisibleAccountPreviewTags,
} from '../utils/accountManagerLayout'
import { generateSecurePassword } from '../utils/securePassword'

const PLATFORM_ACCENTS: Record<AccountPlatform, string> = {
  google: '#8ddc9f',
  microsoft: '#adc6ff',
  other: '#ffb4ab',
}

const sectionLabelSx = {
  fontWeight: 800,
  color: 'text.secondary',
  fontSize: '0.76rem',
  letterSpacing: 0,
  mb: 1.25,
  display: 'block',
  lineHeight: 1.45,
  textTransform: 'uppercase',
}

const panelSx = {
  p: 2,
  borderRadius: 2,
  mb: 2.4,
  bgcolor: (theme: any) => theme.palette.mode === 'dark' ? '#1c1b1b' : '#ffffff',
  borderColor: 'divider',
}

const fieldBoxSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.65,
  px: 1.7,
  py: 1.55,
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: (theme: any) => theme.palette.mode === 'dark' ? '#201f1f' : '#f8fafd',
  '&:hover': {
    borderColor: 'primary.main',
    bgcolor: (theme: any) => theme.palette.mode === 'dark' ? '#2a2a2a' : '#ffffff',
  },
}

function useCopy() {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const copy = useCallback(async (value: string, field: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }, [])
  return { copiedField, copy }
}

function PlatformChip({ platform }: { platform: AccountPlatform }) {
  const accent = PLATFORM_ACCENTS[platform]

  return (
    <Chip
      size="small"
      label={getAccountPlatformLabel(platform)}
      sx={{
        height: 26,
        fontWeight: 700,
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

function getCreatedTagSuggestions(accounts: AccountRow[], currentTags: TagRow[] = []) {
  const current = new Set(currentTags.map((tag) => tag.name.trim().toLowerCase()).filter(Boolean))
  const tagStats = new Map<string, { name: string; count: number }>()

  for (const account of accounts) {
    for (const tag of account.tags || []) {
      const name = tag.name.trim()
      const key = name.toLowerCase()
      if (!name || current.has(key)) continue

      const existing = tagStats.get(key)
      if (existing) {
        existing.count += 1
      } else {
        tagStats.set(key, { name, count: 1 })
      }
    }
  }

  return Array.from(tagStats.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'))
    .map((tag) => tag.name)
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
        InputProps={{
          startAdornment: <InputAdornment position="start">{icon}</InputAdornment>,
          endAdornment: onGenerate || isSecretField ? (
            <InputAdornment position="end">
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {onGenerate && (
                  <Tooltip title="随机生成高强度密码">
                    <IconButton size="small" onClick={onGenerate}>
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {isSecretField && (
                  <Tooltip title={visible ? '隐藏敏感值' : '显示敏感值'}>
                    <IconButton size="small" onClick={() => setVisible((current) => !current)} edge="end">
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
  const handleCopy = () => {
    if (!canCopy) return
    onCopy(value, fieldKey)
  }

  return (
    <Box
      role={canCopy ? 'button' : undefined}
      tabIndex={canCopy ? 0 : undefined}
      onClick={handleCopy}
      onKeyDown={(event) => {
        if (!canCopy) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleCopy()
        }
      }}
      sx={{
        ...fieldBoxSx,
        mb: 1.15,
        cursor: canCopy ? 'pointer' : 'default',
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          color: 'primary.main',
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(173, 198, 255, 0.10)' : 'rgba(11, 87, 208, 0.08)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'block', fontWeight: 800, lineHeight: 1.42 }}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          className={isSecretField ? 'mono-data' : undefined}
          sx={{ fontSize: '0.96rem', color: 'text.primary', mt: 0.35, lineHeight: 1.5, fontWeight: 650 }}
          noWrap
        >
          {isSecretField && !visible ? '••••••••' : value}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, flexShrink: 0 }}>
        {copiedField === fieldKey && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, color: 'success.main', fontSize: '0.78rem', fontWeight: 800 }}>
            <CheckIcon sx={{ fontSize: 16 }} />
            已复制
          </Box>
        )}
        {requiresRevealBeforeCopy && !visible && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.74rem', lineHeight: 1.35 }}>
            先显示
          </Typography>
        )}
        {isSecretField && (
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation()
              setVisible(!visible)
            }}
            sx={{ color: 'text.secondary' }}
          >
            {visible ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
          </IconButton>
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
}: {
  accountId: string
  onClose: () => void
  editSignal?: number
  isPinned: boolean
  onTogglePin: (e: React.MouseEvent) => void
}) {
  const {
    addAccountTag,
    createTotpAccount,
    deleteAccount,
    incrementTotpCounter,
    loadAccounts,
    loadAllAccounts,
    removeAccountTag,
    totpAccounts,
    updateAccount,
    setNavigationBlockReason,
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
  const [linkSecretVisible, setLinkSecretVisible] = useState(false)
  const [linkData, setLinkData] = useState({ issuer: '', label: '', secret: '', otpType: 'totp' })
  const [tagSourceAccounts, setTagSourceAccounts] = useState<AccountRow[]>([])
  const [newTagName, setNewTagName] = useState('')
  const { copiedField, copy } = useCopy()

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

  const loadAccount = async () => {
    const data = await window.electronAPI.getAccountById(accountId)
    if (!data) {
      setAccount(null)
      return
    }

    setAccount(data)
    setCustomFields(data.customFields || [])
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

    const tagSources = await window.electronAPI.getAccounts({ isDeleted: false, platform: 'all' })
    setTagSourceAccounts(tagSources)
  }

  useEffect(() => {
    loadAccount()
  }, [accountId])

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
    if (!name) return

    await updateAccount(accountId, {
      name,
      platform: editData.platform,
      username: editData.username,
      password: editData.password,
      phone: editData.phone,
      backupEmail: editData.backupEmail,
      totpSecret: editData.totpSecret,
      notes: editData.notes,
    }, false)

    const hasLinkedTotp = totpAccounts.some((totpAccount) => totpAccount.linked_account_id === accountId)
    if (editData.totpSecret && editData.totpSecret.trim() && !hasLinkedTotp) {
      setLinkData({
        issuer: editData.name,
        label: editData.username || editData.name,
        secret: editData.totpSecret.trim(),
        otpType: 'totp',
      })
      setLinkSecretVisible(false)
      setLinkTotpDialogOpen(true)
      return
    }

    setEditing(false)
    await loadAccount()
    await Promise.all([loadAccounts(), loadAllAccounts()])
  }

  const handleConfirmLink = async () => {
    await createTotpAccount({
      issuer: linkData.issuer,
      label: linkData.label,
      secret: linkData.secret,
      otpType: linkData.otpType,
      linkedAccountId: accountId,
    })
    setLinkTotpDialogOpen(false)
    setLinkSecretVisible(false)
    setEditing(false)
    await loadAccount()
    await Promise.all([loadAccounts(), loadAllAccounts()])
  }

  const handleSkipLink = async () => {
    setLinkTotpDialogOpen(false)
    setLinkSecretVisible(false)
    setEditing(false)
    await loadAccount()
    await Promise.all([loadAccounts(), loadAllAccounts()])
  }

  const handleDelete = async () => {
    await deleteAccount(accountId)
    setDeleteConfirmOpen(false)
    onClose()
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
    setEditing(false)
  }

  const openAddCustomField = () => {
    setNewFieldName('')
    setNewFieldValue('')
    setNewFieldIsSecret(false)
    setNewFieldValueVisible(false)
    setEditingCustomField(null)
    setShowAddField(true)
  }

  const openEditCustomField = (field: CustomFieldRow) => {
    setNewFieldName(field.field_name)
    setNewFieldValue(field.field_value)
    setNewFieldIsSecret(Boolean(field.is_secret))
    setNewFieldValueVisible(false)
    setEditingCustomField(field)
    setShowAddField(true)
  }

  const handleSaveField = async () => {
    if (!newFieldName.trim()) return
    if (editingCustomField) {
      await window.electronAPI.updateAccountField(editingCustomField.id, {
        fieldName: newFieldName.trim(),
        fieldValue: newFieldValue,
        isSecret: newFieldIsSecret,
      })
    } else {
      await window.electronAPI.addAccountField({
        id: uuidv4(),
        accountId,
        fieldName: newFieldName.trim(),
        fieldValue: newFieldValue,
        isSecret: newFieldIsSecret,
      })
    }
    resetCustomFieldEditor()
    await loadAccount()
  }

  const handleConfirmDeleteField = async () => {
    if (!customFieldDeleteId) return
    await window.electronAPI.deleteAccountField(customFieldDeleteId)
    setCustomFieldDeleteId(null)
    await loadAccount()
  }

  const toggleCustomFieldVisibility = (fieldId: string) => {
    setVisibleCustomFieldIds((ids) => ids.includes(fieldId)
      ? ids.filter((id) => id !== fieldId)
      : [...ids, fieldId])
  }

  const handleAddTag = async (tagName: string) => {
    if (!tagName.trim()) return
    await addAccountTag(accountId, tagName.trim())
    setNewTagName('')
    await loadAccount()
  }

  const handleRemoveTag = async (tagId: string) => {
    await removeAccountTag(accountId, tagId)
    await loadAccount()
  }

  if (!account) return null

  const linkedTotpAccount = totpAccounts.find((totpAccount) => totpAccount.linked_account_id === accountId)
  const displayedTotpSecret = linkedTotpAccount?.secret || account.totp_secret
  const hasTotpSecret = Boolean(!editing && displayedTotpSecret && displayedTotpSecret.trim())
  const createdTagSuggestions = getCreatedTagSuggestions(tagSourceAccounts, account.tags || [])
  const sectionOrder = getAccountDetailSectionOrder(hasTotpSecret)

  const renderAccountInfoSection = () => (
    <React.Fragment key="account-info">
      <Typography variant="caption" sx={sectionLabelSx}>
        账号信息
      </Typography>
      <Paper variant="outlined" sx={panelSx}>
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
          <Box sx={{ ...fieldBoxSx, mb: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                color: 'primary.main',
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(173, 198, 255, 0.10)' : 'rgba(11, 87, 208, 0.08)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <PublicOutlinedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'block', fontWeight: 800, lineHeight: 1.42 }}>
                主账号类型
              </Typography>
              <PlatformChip platform={account.platform} />
            </Box>
          </Box>
        )}

        <SensitiveField icon={<PersonIcon sx={{ fontSize: 18 }} />} label="主邮箱 / 登录账号" value={editing ? editData.username : account.username} fieldKey="username" copiedField={copiedField} onCopy={copy} editing={editing} onChange={(value) => setEditData({ ...editData, username: value })} />
        <SensitiveField
          icon={<LockIcon sx={{ fontSize: 18 }} />}
          label="密码"
          value={editing ? editData.password : account.password}
          fieldKey="password"
          copiedField={copiedField}
          onCopy={copy}
          editing={editing}
          onChange={(value) => setEditData({ ...editData, password: value })}
          onGenerate={
            editing
              ? () => {
                    setEditData({ ...editData, password: generateSecurePassword() })
                }
              : undefined
          }
        />
        <SensitiveField icon={<PhoneIcon sx={{ fontSize: 18 }} />} label="绑定手机号" value={editing ? editData.phone : account.phone} fieldKey="phone" copiedField={copiedField} onCopy={copy} editing={editing} onChange={(value) => setEditData({ ...editData, phone: value })} />
        <SensitiveField icon={<EmailIcon sx={{ fontSize: 18 }} />} label="备用邮箱" value={editing ? editData.backupEmail : account.backup_email} fieldKey="backup_email" copiedField={copiedField} onCopy={copy} editing={editing} onChange={(value) => setEditData({ ...editData, backupEmail: value })} />
        <SensitiveField icon={<SecurityIcon sx={{ fontSize: 18 }} />} label="2FA 密钥" value={editing ? editData.totpSecret : account.totp_secret} fieldKey="totp_secret" copiedField={copiedField} onCopy={copy} editing={editing} onChange={(value) => setEditData({ ...editData, totpSecret: value })} />
      </Paper>
    </React.Fragment>
  )

  const renderRealtimeCodeSection = () => (
    <React.Fragment key="realtime-code">
      <Typography variant="caption" sx={sectionLabelSx}>
        实时验证码
      </Typography>
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
            ? () => { void incrementTotpCounter(linkedTotpAccount.id) }
            : undefined}
        />
      </Box>
    </React.Fragment>
  )

  const renderTagsSection = () => (
    <React.Fragment key="registered-platform-tags">
      <Typography variant="caption" sx={sectionLabelSx}>
        注册平台标签
      </Typography>
      <Paper variant="outlined" sx={panelSx}>
        {(account.tags || []).length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.85, mb: 1.65 }}>
            {(account.tags || []).map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                onDelete={() => handleRemoveTag(tag.id)}
                sx={{
                  bgcolor: `${tag.color}22`,
                  color: tag.color,
                  border: '1px solid',
                  borderColor: `${tag.color}55`,
                  '& .MuiChip-deleteIcon': { color: 'inherit' },
                }}
              />
            ))}
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
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleAddTag(newTagName)
              }
            }}
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
            onClick={() => handleAddTag(newTagName)}
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
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.2, lineHeight: 1.45, fontSize: '0.75rem', fontWeight: 800 }}>
              已创建标签
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.95 }}>
              {createdTagSuggestions.slice(0, 12).map((tag) => (
                <Chip key={tag} label={tag} variant="outlined" onClick={() => handleAddTag(tag)} sx={{ height: 28, fontWeight: 700 }} />
              ))}
            </Box>
          </>
        )}
      </Paper>
    </React.Fragment>
  )

  const renderCustomFieldsSection = () => (
    <React.Fragment key="custom-fields">
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" sx={{ ...sectionLabelSx, flex: 1, mb: 0 }}>
          自定义字段
        </Typography>
        {!editing && (
          <IconButton size="small" onClick={openAddCustomField} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
            <AddCircleOutlineIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Box>

      {customFields.length > 0 && (
        <Paper variant="outlined" sx={panelSx}>
          {customFields.map((field, index) => (
            <Box key={field.id}>
              {index > 0 && <Box sx={{ height: 10 }} />}
              <Box sx={{ ...fieldBoxSx, '&:hover .cf-actions': { opacity: 1 } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'block', fontWeight: 800, lineHeight: 1.42 }}>
                    {field.field_name} {field.is_secret ? '敏感' : ''}
                  </Typography>
                  <Typography
                    variant="body2"
                    className={field.is_secret ? 'mono-data' : undefined}
                    sx={{ fontSize: '0.96rem', color: 'text.primary', mt: 0.35, lineHeight: 1.5, fontWeight: 650 }}
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
                      <IconButton size="small" onClick={() => toggleCustomFieldVisibility(field.id)} sx={{ color: 'text.secondary' }}>
                        {visibleCustomFieldIds.includes(field.id)
                          ? <VisibilityOffIcon sx={{ fontSize: 14 }} />
                          : <VisibilityIcon sx={{ fontSize: 14 }} />}
                      </IconButton>
                    </Tooltip>
                  )}
                  <IconButton size="small" onClick={() => copy(field.field_value, field.id)} sx={{ color: copiedField === field.id ? 'success.main' : 'text.secondary' }}>
                    {copiedField === field.id ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
                  </IconButton>
                  <IconButton size="small" onClick={() => openEditCustomField(field)} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                    <EditIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => setCustomFieldDeleteId(field.id)} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                    <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
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
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleSaveField()
              }
            }}
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
            InputProps={{
              endAdornment: newFieldIsSecret ? (
                <InputAdornment position="end">
                  <Tooltip title={newFieldValueVisible ? '隐藏敏感值' : '显示敏感值'}>
                    <IconButton size="small" onClick={() => setNewFieldValueVisible((current) => !current)} edge="end">
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
              variant="outlined"
              color={newFieldIsSecret ? 'warning' : 'default'}
            />
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={resetCustomFieldEditor}>
              取消
            </Button>
            <Button size="small" variant="contained" onClick={handleSaveField} disabled={!newFieldName.trim()}>
              {editingCustomField ? '保存' : '添加'}
            </Button>
          </Box>
        </Paper>
      )}
    </React.Fragment>
  )

  const renderNotesSection = () => (
    <React.Fragment key="notes">
      <Typography variant="caption" sx={sectionLabelSx}>
        备注
      </Typography>
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
            '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? '#201f1f' : '#ffffff' },
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
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid',
        borderColor: 'divider',
        height: '100%',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          p: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1.95,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 3,
            display: 'grid',
            placeItems: 'center',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? '#201f1f' : '#f8fafd',
            border: '1px solid',
            borderColor: 'divider',
            color: 'primary.main',
            flexShrink: 0,
          }}
        >
          <AccountBoxIcon sx={{ fontSize: 30 }} />
        </Box>
        {editing ? (
          <TextField
            size="small"
            value={editData.name}
            onChange={(event) => setEditData({ ...editData, name: event.target.value })}
            sx={{ flex: 1 }}
            variant="standard"
            inputProps={{ style: { fontSize: '1.1rem', fontWeight: 600 } }}
          />
        ) : (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.28rem', lineHeight: 1.3 }} noWrap>
              {account.name}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.45, fontSize: '0.82rem', lineHeight: 1.45 }} noWrap>
              {account.username || '未设置主邮箱 / 登录账号'}
            </Typography>
            <Box sx={{ mt: 1.1, display: 'flex', gap: 0.85, flexWrap: 'wrap' }}>
              <PlatformChip platform={account.platform} />
              {account.totp_secret && account.totp_secret.trim() && (
                <Chip size="small" label="已记录 2FA" variant="outlined" sx={{ color: 'success.main', borderColor: 'rgba(141, 220, 159, 0.45)' }} />
              )}
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {editing ? (
            <>
              <IconButton size="small" onClick={handleSave} disabled={!editData.name.trim() || !hasUnsavedAccountChanges} sx={{ color: 'success.main' }}>
                <SaveIcon sx={{ fontSize: 20 }} />
              </IconButton>
              <IconButton size="small" onClick={handleCancelEdit} sx={{ color: 'text.secondary' }}>
                <CloseIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </>
          ) : (
            <>
              <Tooltip title={isPinned ? "取消置顶" : "置顶主账号"} arrow TransitionComponent={Fade}>
                <IconButton
                  size="small"
                  onClick={onTogglePin}
                  sx={{ color: isPinned ? 'primary.main' : 'text.secondary' }}
                >
                  {isPinned ? <PushPinIcon sx={{ fontSize: 20 }} /> : <PushPinOutlinedIcon sx={{ fontSize: 20 }} />}
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => setEditing(true)} sx={{ color: 'text.secondary' }}>
                <EditIcon sx={{ fontSize: 20 }} />
              </IconButton>
              <IconButton size="small" onClick={() => setDeleteConfirmOpen(true)} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                <DeleteOutlineIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </>
          )}
        </Box>
      </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 3.1 }}>
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

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
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
          <Button onClick={() => setDeleteConfirmOpen(false)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            移入回收站
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={linkTotpDialogOpen} onClose={handleSkipLink} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon sx={{ color: 'primary.main' }} />
          自动生成 2FA 账户
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, mt: 1 }}>
            检测到你为该账号写入了 2FA 密钥。是否一并在 2FA 面板中生成并绑定对应卡片？
          </Typography>
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
                    <IconButton size="small" onClick={() => setLinkSecretVisible((current) => !current)} edge="end">
                      {linkSecretVisible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSkipLink}>跳过</Button>
          <Button variant="contained" onClick={handleConfirmLink}>
            生成并绑定
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={customFieldDeleteId !== null} onClose={() => setCustomFieldDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          删除自定义字段
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">确定删除这个自定义字段吗？该操作无法撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomFieldDeleteId(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDeleteField}>删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

type PendingAccountAction =
  | { kind: 'select'; accountId: string | null; edit: boolean }
  | { kind: 'create'; platform: AccountPlatform }

export default function AccountsView() {
  const {
    accountPlatformFilter,
    accountSearchQuery,
    accounts,
    createAccount,
    deleteAccount,
    importCsvAccounts,
    loadAccounts,
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
  const { copiedField, copy } = useCopy()

  // Drag and drop states for custom account ordering
  const [draggedId, setDraggedId] = useState<string | null>(null)

  // List container custom width states
  const [listWidth, setListWidth] = useState(320)

  useEffect(() => {
    let mounted = true
    window.electronAPI.getAppPreferences().then((preferences) => {
      if (!mounted) return
      let savedWidth = preferences.accountsListWidth
      if (typeof savedWidth !== 'number') {
        const legacyWidthValue = localStorage.getItem('accounts_list_width')
        const legacyWidth = legacyWidthValue === null ? Number.NaN : Number(legacyWidthValue)
        if (Number.isFinite(legacyWidth)) {
          savedWidth = Math.max(300, Math.min(560, legacyWidth))
          void window.electronAPI.updateAppPreferences({ accountsListWidth: savedWidth })
          localStorage.removeItem('accounts_list_width')
        }
      }
      if (typeof savedWidth === 'number') {
        const normalizedWidth = Math.max(300, Math.min(560, savedWidth))
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
      const newWidth = Math.max(300, Math.min(560, startWidth + (moveEvent.clientX - startX)))
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
    updateAccountsCustomOrder(newSortedIds)

    setDraggedId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
  }

  useEffect(() => {
    loadAccounts()
    loadTotpAccounts()
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
    const defaultName = platform === 'google'
      ? 'Google 账号'
      : platform === 'microsoft'
        ? 'Microsoft 账号'
        : '新账号'
    const id = await createAccount(defaultName, platform)
    setSelectedAccount(id)
    setEditSignal(Date.now())
    setPlatformDialogOpen(false)
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
    selectAccount(action.accountId, action.edit)
  }

  const handleImportCsv = async () => {
    try {
      const result = await importCsvAccounts()
      const warnings = [
        result.invalidTotpCount > 0 ? `${result.invalidTotpCount} 个无效 OTP URI 已跳过` : '',
        result.skippedRowCount > 0 ? `${result.skippedRowCount} 行没有可识别字段` : '',
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
    if (listDeleteConfirm) {
      await deleteAccount(listDeleteConfirm)
      setListDeleteConfirm(null)
    }
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', bgcolor: 'background.default' }}>
      <Box
        sx={{
          width: listWidth,
          minWidth: listWidth,
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0e0e0e' : '#ffffff',
        }}
      >
        <Box sx={{ p: 2.55, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'grid', gap: 0.75 }}>
            <Typography variant="h6" sx={{ fontSize: '1.12rem', fontWeight: 850, lineHeight: 1.38 }}>
              主账号仓库
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.86rem', lineHeight: 1.68 }}>
              集中管理 Google / Microsoft 主账号。
              <Box component="span" sx={{ display: 'block', mt: 0.2 }}>
                用标签记录它们登录过的平台。
              </Box>
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.85, mt: 2.25 }}>
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
                disabled={Boolean(navigationBlockReason)}
                onClick={() => setAccountPlatformFilter(value)}
              />
            ))}
          </Box>
        </Box>

        <Box sx={{ p: 1.8, display: 'flex', gap: 1.15, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <TextField
            size="small"
            placeholder="搜索主账号..."
            value={accountSearchQuery}
            disabled={Boolean(navigationBlockReason)}
            onChange={(event) => setAccountSearchQuery(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1 }}
          />
          <Tooltip title="导入 CSV" arrow>
            <IconButton onClick={handleImportCsv} sx={{ color: 'text.secondary', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', '&:hover': { color: 'primary.main', bgcolor: 'action.hover' } }}>
              <FileUploadOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="新建主账号" arrow>
            <IconButton onClick={() => setPlatformDialogOpen(true)} sx={{ color: 'primary.main', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}>
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 1.3 }}>
          {accounts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, px: 3, border: '1px dashed', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
              <AccountBoxIcon sx={{ fontSize: 44, color: 'text.secondary', opacity: 0.42, mb: 1.5 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                当前筛选下还没有主账号
              </Typography>
              <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setPlatformDialogOpen(true)}>
                添加账号
              </Button>
            </Box>
          ) : (
            sortedAccounts.map((account) => (
              <Box
                key={account.id}
                draggable
                onDragStart={(e) => handleDragStart(e, account.id)}
                onDragOver={(e) => handleDragOver(e, account.id)}
                onDrop={(e) => handleDrop(e, account.id)}
                onDragEnd={handleDragEnd}
                onClick={() => requestAccountSelection(account.id)}
                onContextMenu={(event) => handleContextMenu(event, account.id)}
                onMouseEnter={() => setHoveredId(account.id)}
                onMouseLeave={() => setHoveredId(null)}
                sx={{
                  px: 1.7,
                  py: 1.55,
                  mb: 1.05,
                  cursor: 'grab',
                  border: '1px solid',
                  borderColor: selectedAccountId === account.id ? 'primary.main' : 'transparent',
                  borderLeft: '2px solid',
                  borderLeftColor: selectedAccountId === account.id
                    ? 'primary.main'
                    : accountsPinnedIds.includes(account.id)
                      ? 'secondary.main'
                      : 'transparent',
                  borderRadius: 2,
                  bgcolor: selectedAccountId === account.id
                    ? 'action.selected'
                    : (theme) => theme.palette.mode === 'dark' ? '#131313' : '#ffffff',
                  opacity: draggedId === account.id ? 0.35 : 1,
                  transform: draggedId === account.id ? 'scale(0.98)' : 'scale(1)',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease, opacity 0.15s ease',
                  '&:active': { cursor: 'grabbing' },
                  '&:hover': {
                    bgcolor: selectedAccountId === account.id ? 'action.selected' : 'action.hover',
                    borderColor: draggedId && draggedId !== account.id ? 'primary.main' : 'divider',
                    borderLeftColor: selectedAccountId === account.id ? 'primary.main' : accountsPinnedIds.includes(account.id) ? 'secondary.main' : 'divider',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.45 }}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      bgcolor: `${PLATFORM_ACCENTS[account.platform]}22`,
                      color: PLATFORM_ACCENTS[account.platform],
                      border: '1px solid',
                      borderColor: `${PLATFORM_ACCENTS[account.platform]}55`,
                    }}
                  >
                    <AccountBoxIcon sx={{ fontSize: 22 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, mb: 0.85, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.4, flex: 1, minWidth: 0 }} noWrap>
                        {account.name}
                      </Typography>
                      <PlatformChip platform={account.platform} />
                    </Box>

                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.78rem', display: 'block', lineHeight: 1.42 }} noWrap>
                      {account.username || '未设置主邮箱 / 登录账号'}
                    </Typography>

                    {(account.tags || []).length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 1.1 }}>
                        {getVisibleAccountPreviewTags(account.tags || []).map((tag) => (
                          <Chip
                            key={tag.id}
                            label={tag.name}
                            size="small"
                            sx={{
                              height: 23,
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

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                    <Tooltip title={accountsPinnedIds.includes(account.id) ? "取消置顶" : "置顶主账号"} arrow TransitionComponent={Fade}>
                      <IconButton
                        size="small"
                        onClick={(event) => { event.stopPropagation(); togglePinAccount(account.id) }}
                        sx={{
                          color: accountsPinnedIds.includes(account.id) ? 'primary.main' : 'text.secondary',
                          opacity: accountsPinnedIds.includes(account.id) ? 1 : (hoveredId === account.id ? 0.85 : 0.25),
                          transition: 'opacity 0.15s',
                          '&:hover': { color: 'primary.main', opacity: 1 }
                        }}
                      >
                        {accountsPinnedIds.includes(account.id) ? <PushPinIcon sx={{ fontSize: 16 }} /> : <PushPinOutlinedIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </Tooltip>

                    {account.totp_secret && account.totp_secret.trim() && (
                      <Tooltip title="已启用 2FA" arrow>
                        <ShieldIcon sx={{ fontSize: 16, color: '#81c995' }} />
                      </Tooltip>
                    )}
                    {hoveredId === account.id && account.password && (
                      <Tooltip title={copiedField === `pwd-${account.id}` ? '已复制!' : '复制密码'} arrow TransitionComponent={Fade}>
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation()
                            copy(account.password, `pwd-${account.id}`)
                          }}
                          sx={{ color: copiedField === `pwd-${account.id}` ? 'success.main' : 'text.secondary' }}
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

      {/* 垂直拖动分割条 */}
      <Box
        onMouseDown={handleListResizeStart}
        sx={{
          width: 6,
          cursor: 'col-resize',
          bgcolor: 'transparent',
          transition: 'background-color 0.2s',
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
          }
        }}
      />

      {selectedAccountId ? (
        <AccountDetail
          key={selectedAccountId}
          accountId={selectedAccountId}
          onClose={() => requestAccountSelection(null)}
          editSignal={editSignal}
          isPinned={accountsPinnedIds.includes(selectedAccountId)}
          onTogglePin={(e) => { e.stopPropagation(); togglePinAccount(selectedAccountId) }}
        />
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <Box
            sx={{
              textAlign: 'center',
              px: 4,
              py: 5,
              maxWidth: 420,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              bgcolor: 'background.paper',
            }}
          >
            <LockIcon sx={{ fontSize: 56, color: 'primary.main', opacity: 0.32, mb: 2 }} />
            <Typography variant="h6" sx={{ color: 'text.primary', mb: 1, fontWeight: 800 }}>
              选择或创建一个主账号
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', opacity: 0.8, mb: 3 }}>
              这里专门记录你的 Google / Microsoft 账号、2FA 密钥和它们登录过的平台标签。
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setPlatformDialogOpen(true)}>
              立刻添加主账号
            </Button>
          </Box>
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
        <MenuItem onClick={() => { setListDeleteConfirm(contextMenu?.accountId || null); setContextMenu(null) }}>
          <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>移入回收站</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={listDeleteConfirm !== null} onClose={() => setListDeleteConfirm(null)} maxWidth="xs" fullWidth>
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
          <Button onClick={() => setListDeleteConfirm(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDeleteFromList}>移入回收站</Button>
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
      />
      <Snackbar open={notice !== null} autoHideDuration={4500} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={notice?.severity || 'info'} variant="filled" onClose={() => setNotice(null)} sx={{ width: '100%' }}>
          {notice?.text}
        </Alert>
      </Snackbar>
    </Box>
  )
}
