export const accountPanelSx = {
  p: 1.5,
  borderRadius: 1,
  mb: 2,
  bgcolor: 'surface.raised',
  borderColor: 'border.subtle',
  boxShadow: 'none',
}

export const accountFieldPanelSx = {
  p: 0,
  borderRadius: 1,
  mb: 2,
  overflow: 'hidden',
  bgcolor: 'surface.raised',
  borderColor: 'border.subtle',
  boxShadow: 'none',
}

export const accountFieldRowSx = {
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
