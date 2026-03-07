import React, { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, IconButton, Button, TextField, Paper,
  InputAdornment, Tooltip, Fade, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, Menu, MenuItem, ListItemIcon, ListItemText,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
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
import { useStore } from '../stores/useStore'
import { AccountRow, CustomFieldRow } from '../types'
import { v4 as uuidv4 } from 'uuid'
import TotpCodeDisplay from './TotpCodeDisplay'

// Clipboard copy hook
function useCopy() {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const copy = useCallback(async (value: string, field: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }, [])
  return { copiedField, copy }
}

// Sensitive field with show/hide + copy
function SensitiveField({
  icon, label, value, fieldKey, copiedField, onCopy, editing,
  onChange,
}: {
  icon: React.ReactNode; label: string; value: string; fieldKey: string
  copiedField: string | null; onCopy: (val: string, key: string) => void
  editing: boolean; onChange?: (val: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const hasValue = value && value.length > 0

  if (editing) {
    return (
      <TextField
        fullWidth
        size="small"
        label={label}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        InputProps={{
          startAdornment: <InputAdornment position="start">{icon}</InputAdornment>,
        }}
        sx={{ mb: 1.5 }}
      />
    )
  }

  if (!hasValue) return null

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', py: 0.75, '&:hover .field-actions': { opacity: 1 } }}>
      <Box sx={{ mr: 1.5, color: 'text.secondary', display: 'flex' }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block' }}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontFamily: fieldKey === 'password' || fieldKey === 'totp_secret' ? 'monospace' : 'inherit', fontSize: '0.875rem' }}
          noWrap
        >
          {(fieldKey === 'password' || fieldKey === 'totp_secret') && !visible
            ? '••••••••'
            : value}
        </Typography>
      </Box>
      <Box className="field-actions" sx={{ display: 'flex', gap: 0.25, opacity: 0, transition: 'opacity 0.15s' }}>
        {(fieldKey === 'password' || fieldKey === 'totp_secret') && (
          <IconButton size="small" onClick={() => setVisible(!visible)} sx={{ color: 'text.secondary' }}>
            {visible ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        )}
        <Tooltip title={copiedField === fieldKey ? '已复制!' : '复制'} arrow TransitionComponent={Fade}>
          <IconButton size="small" onClick={() => onCopy(value, fieldKey)} sx={{ color: copiedField === fieldKey ? 'success.main' : 'text.secondary' }}>
            {copiedField === fieldKey ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}

// Account detail panel
function AccountDetail({
  accountId,
  onClose,
  editSignal,
}: {
  accountId: string
  onClose: () => void
  editSignal?: number
}) {
  const { updateAccount, deleteAccount, totpAccounts, createTotpAccount } = useStore()
  const [account, setAccount] = useState<AccountRow | null>(null)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({ name: '', username: '', password: '', phone: '', backupEmail: '', totpSecret: '', notes: '' })
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>([])
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldIsSecret, setNewFieldIsSecret] = useState(false)
  const [showAddField, setShowAddField] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [linkPromptOpen, setLinkPromptOpen] = useState(false)
  const [linkData, setLinkData] = useState({ issuer: '', label: '', secret: '', otpType: 'totp' })
  const { copiedField, copy } = useCopy()

  const loadAccount = async () => {
    const data = await window.electronAPI.getAccountById(accountId)
    if (data) {
      setAccount(data)
      setCustomFields(data.customFields || [])
      setEditData({
        name: data.name, username: data.username, password: data.password,
        phone: data.phone, backupEmail: data.backup_email, totpSecret: data.totp_secret,
        notes: data.notes,
      })
    }
  }

  useEffect(() => { loadAccount() }, [accountId])
  
  useEffect(() => {
    if (editSignal && editSignal > 0) {
      setEditing(true)
    }
  }, [editSignal])

  const handleSave = async () => {
    await updateAccount(accountId, {
      name: editData.name,
      username: editData.username,
      password: editData.password,
      phone: editData.phone,
      backupEmail: editData.backupEmail,
      totpSecret: editData.totpSecret,
      notes: editData.notes,
    })
    
    // Check if we should prompt for 2FA linkage
    const hasLinkedTotp = totpAccounts.some(t => t.linked_account_id === accountId)
    if (editData.totpSecret && editData.totpSecret.trim() && !hasLinkedTotp) {
      setLinkData({
        issuer: editData.name,
        label: editData.username,
        secret: editData.totpSecret.trim(),
        otpType: 'totp',
      })
      setLinkPromptOpen(true)
    } else {
      setEditing(false)
      await loadAccount()
    }
  }

  const handleConfirmLink = async () => {
    await createTotpAccount(linkData.issuer, linkData.label, linkData.secret, linkData.otpType, accountId)
    setLinkPromptOpen(false)
    setEditing(false)
    await loadAccount()
  }

  const handleSkipLink = async () => {
    setLinkPromptOpen(false)
    setEditing(false)
    await loadAccount()
  }

  const handleDelete = async () => {
    await deleteAccount(accountId)
    setDeleteConfirmOpen(false)
    onClose()
  }

  const handleAddField = async () => {
    if (!newFieldName.trim()) return
    const id = uuidv4()
    await window.electronAPI.addAccountField({
      id, accountId, fieldName: newFieldName.trim(), fieldValue: '', isSecret: newFieldIsSecret,
    })
    setNewFieldName('')
    setNewFieldIsSecret(false)
    setShowAddField(false)
    await loadAccount()
  }

  const handleUpdateField = async (fieldId: string, value: string, isSecret: boolean) => {
    await window.electronAPI.updateAccountField(fieldId, { fieldValue: value, isSecret })
    await loadAccount()
  }

  const handleDeleteField = async (fieldId: string) => {
    await window.electronAPI.deleteAccountField(fieldId)
    await loadAccount()
  }

  if (!account) return null

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid', borderColor: 'divider', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <AccountBoxIcon sx={{ color: 'primary.main' }} />
        {editing ? (
          <TextField
            size="small"
            value={editData.name}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            sx={{ flex: 1 }}
            variant="standard"
            inputProps={{ style: { fontSize: '1.1rem', fontWeight: 600 } }}
          />
        ) : (
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem', flex: 1 }} noWrap>
            {account.name}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {editing ? (
            <>
              <IconButton size="small" onClick={handleSave} sx={{ color: 'success.main' }}>
                <SaveIcon sx={{ fontSize: 20 }} />
              </IconButton>
              <IconButton size="small" onClick={() => setEditing(false)} sx={{ color: 'text.secondary' }}>
                <CloseIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </>
          ) : (
            <>
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

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {/* Fixed fields */}
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: '0.06em', mb: 1, display: 'block' }}>
          基本信息
        </Typography>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2 }}>
          <SensitiveField icon={<PersonIcon sx={{ fontSize: 18 }} />} label="账号" value={editing ? editData.username : account.username} fieldKey="username" copiedField={copiedField} onCopy={copy} editing={editing} onChange={(v) => setEditData({ ...editData, username: v })} />
          <SensitiveField icon={<LockIcon sx={{ fontSize: 18 }} />} label="密码" value={editing ? editData.password : account.password} fieldKey="password" copiedField={copiedField} onCopy={copy} editing={editing} onChange={(v) => setEditData({ ...editData, password: v })} />
          <SensitiveField icon={<PhoneIcon sx={{ fontSize: 18 }} />} label="绑定手机号" value={editing ? editData.phone : account.phone} fieldKey="phone" copiedField={copiedField} onCopy={copy} editing={editing} onChange={(v) => setEditData({ ...editData, phone: v })} />
          <SensitiveField icon={<EmailIcon sx={{ fontSize: 18 }} />} label="备用邮箱" value={editing ? editData.backupEmail : account.backup_email} fieldKey="backup_email" copiedField={copiedField} onCopy={copy} editing={editing} onChange={(v) => setEditData({ ...editData, backupEmail: v })} />
          <SensitiveField icon={<SecurityIcon sx={{ fontSize: 18 }} />} label="2FA 密钥" value={editing ? editData.totpSecret : account.totp_secret} fieldKey="totp_secret" copiedField={copiedField} onCopy={copy} editing={editing} onChange={(v) => setEditData({ ...editData, totpSecret: v })} />
        </Paper>

        {/* Inline TOTP code display */}
        {!editing && account.totp_secret && account.totp_secret.trim() && (
          <>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: '0.06em', mb: 1, display: 'block' }}>
              实时验证码
            </Typography>
            <Box sx={{ mb: 2 }}>
              <TotpCodeDisplay secret={account.totp_secret} compact />
            </Box>
          </>
        )}

        {/* Custom fields */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: '0.06em', flex: 1 }}>
            自定义字段
          </Typography>
          {!editing && (
            <IconButton size="small" onClick={() => setShowAddField(true)} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
              <AddCircleOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Box>

        {customFields.length > 0 && (
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2 }}>
            {customFields.map((field, idx) => (
              <Box key={field.id}>
                {idx > 0 && <Divider sx={{ my: 0.5 }} />}
                <Box sx={{ display: 'flex', alignItems: 'center', py: 0.75, '&:hover .cf-actions': { opacity: 1 } }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block' }}>
                      {field.field_name} {field.is_secret ? '🔒' : ''}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem', fontFamily: field.is_secret ? 'monospace' : 'inherit' }} noWrap>
                      {field.field_value || '(空)'}
                    </Typography>
                  </Box>
                  <Box className="cf-actions" sx={{ display: 'flex', gap: 0.25, opacity: 0, transition: 'opacity 0.15s' }}>
                    <IconButton size="small" onClick={() => copy(field.field_value, field.id)} sx={{ color: copiedField === field.id ? 'success.main' : 'text.secondary' }}>
                      {copiedField === field.id ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteField(field.id)} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                      <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                </Box>
              </Box>
            ))}
          </Paper>
        )}

        {showAddField && (
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2 }}>
            <TextField
              fullWidth size="small" label="字段名称" value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={newFieldIsSecret ? '🔒 加密字段' : '📝 普通字段'}
                size="small"
                onClick={() => setNewFieldIsSecret(!newFieldIsSecret)}
                variant="outlined"
                color={newFieldIsSecret ? 'warning' : 'default'}
              />
              <Box sx={{ flex: 1 }} />
              <Button size="small" onClick={() => setShowAddField(false)}>取消</Button>
              <Button size="small" variant="contained" onClick={handleAddField}>添加</Button>
            </Box>
          </Paper>
        )}

        {/* Notes */}
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: '0.06em', mb: 1, display: 'block' }}>
          备注
        </Typography>
        {editing ? (
          <TextField
            fullWidth
            multiline
            minRows={4}
            maxRows={12}
            value={editData.notes}
            onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
            placeholder="支持 Markdown 格式..."
            sx={{
              '& .MuiInputBase-root': { fontFamily: "'Inter', monospace", fontSize: '0.85rem', lineHeight: 1.6 },
              '& .MuiOutlinedInput-root': { borderRadius: 2 },
            }}
          />
        ) : (
          account.notes ? (
            <Paper
              variant="outlined"
              sx={{ p: 1.5, borderRadius: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              onClick={() => setNotesExpanded(!notesExpanded)}
            >
              <Typography
                variant="body2"
                sx={{
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
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
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', fontStyle: 'italic' }}>
              暂无备注
            </Typography>
          )
        )}
      </Box>

      {/* Delete confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          确认删除账号
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">确定要删除 <strong>{account.name}</strong> 的所有信息吗？</Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'error.main', fontSize: '0.8rem' }}>
            ⚠️ 删除后将无法恢复，请确保已备份重要信息。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>确认删除</Button>
        </DialogActions>
      </Dialog>

      {/* 2FA Linkage Prompt Dialog */}
      <Dialog open={linkPromptOpen} onClose={handleSkipLink} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon sx={{ color: 'primary.main' }} />
          自动生成 2FA 账户
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, mt: 1 }}>
            检测到您为该账号关联了 2FA 密钥。是否随之在 2FA 验证器中生成并绑定对应的账户？
          </Typography>
          <TextField
            fullWidth size="small" label="服务商 (来自账号名称)" value={linkData.issuer}
            onChange={(e) => setLinkData({ ...linkData, issuer: e.target.value })} sx={{ mb: 2 }}
          />
          <TextField
            fullWidth size="small" label="账户名称 (来自账号)" value={linkData.label}
            onChange={(e) => setLinkData({ ...linkData, label: e.target.value })} sx={{ mb: 2 }}
          />
          <TextField
            fullWidth size="small" label="密钥" value={linkData.secret}
            onChange={(e) => setLinkData({ ...linkData, secret: e.target.value })} sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSkipLink}>否 (跳过)</Button>
          <Button variant="contained" onClick={handleConfirmLink}>是 (生成此卡片)</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// Main AccountManager component
export default function AccountManager() {
  const { accounts, loadAccounts, createAccount, deleteAccount, selectedAccountId, setSelectedAccount, accountSearchQuery, setAccountSearchQuery, loadTotpAccounts } = useStore()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; accountId: string } | null>(null)
  const [listDeleteConfirm, setListDeleteConfirm] = useState<string | null>(null)
  const [editSignal, setEditSignal] = useState(0)
  const { copiedField, copy } = useCopy()

  useEffect(() => { 
    loadAccounts()
    loadTotpAccounts()
  }, [accountSearchQuery])

  const handleCreate = async () => {
    await createAccount('新账号')
  }

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setContextMenu(
      contextMenu === null
        ? { mouseX: e.clientX + 2, mouseY: e.clientY - 6, accountId: id }
        : null
    )
  }

  const handleQuickEdit = () => {
    if (contextMenu) {
      setSelectedAccount(contextMenu.accountId)
      setEditSignal(Date.now())
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
    <Box sx={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Account list */}
      <Box sx={{ width: 320, minWidth: 320, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Search + Add */}
        <Box sx={{ p: 1.5, display: 'flex', gap: 1, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <TextField
            size="small"
            placeholder="搜索账号..."
            value={accountSearchQuery}
            onChange={(e) => setAccountSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
            }}
            sx={{ flex: 1 }}
          />
          <IconButton onClick={handleCreate} sx={{ color: 'primary.main' }}>
            <AddIcon />
          </IconButton>
        </Box>

        {/* List */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {accounts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
              <AccountBoxIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.4, mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                暂无账号
              </Typography>
              <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleCreate}>
                添加账号
              </Button>
            </Box>
          ) : (
            accounts.map((acc) => (
              <Box
                key={acc.id}
                onClick={() => setSelectedAccount(acc.id)}
                onContextMenu={(e) => handleContextMenu(e, acc.id)}
                onMouseEnter={() => setHoveredId(acc.id)}
                onMouseLeave={() => setHoveredId(null)}
                sx={{
                  px: 2, py: 1.25,
                  cursor: 'pointer',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: selectedAccountId === acc.id ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: selectedAccountId === acc.id ? 'action.selected' : 'action.hover' },
                  transition: 'background-color 0.1s',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem' }} noWrap>
                      {acc.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }} noWrap>
                      {acc.username || '未设置账号'}
                    </Typography>
                  </Box>
                  {acc.totp_secret && acc.totp_secret.trim() && (
                    <Tooltip title="已启用 2FA" arrow>
                      <ShieldIcon sx={{ fontSize: 16, color: '#81c995', mx: 0.5, flexShrink: 0 }} />
                    </Tooltip>
                  )}
                  {hoveredId === acc.id && acc.password && (
                    <Tooltip title={copiedField === `pwd-${acc.id}` ? '已复制!' : '复制密码'} arrow TransitionComponent={Fade}>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); copy(acc.password, `pwd-${acc.id}`) }}
                        sx={{ color: copiedField === `pwd-${acc.id}` ? 'success.main' : 'text.secondary' }}
                      >
                        {copiedField === `pwd-${acc.id}` ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Box>

      {/* Detail panel */}
      {selectedAccountId ? (
        <AccountDetail accountId={selectedAccountId} onClose={() => setSelectedAccount(null)} editSignal={editSignal} />
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ textAlign: 'center', px: 3 }}>
            <LockIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              选择一个账号查看详情
            </Typography>
          </Box>
        </Box>
      )}

      {/* Context Menu */}
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
          <ListItemText sx={{ color: 'error.main' }}>删除账号</ListItemText>
        </MenuItem>
      </Menu>

      {/* List Delete confirmation */}
      <Dialog open={listDeleteConfirm !== null} onClose={() => setListDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          确认删除账号
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">确定要删除该账号的所有信息吗？</Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'error.main', fontSize: '0.8rem' }}>
            ⚠️ 删除后将无法恢复，包含的 2FA 记录也会一并删除。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setListDeleteConfirm(null)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDeleteFromList}>确认删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
