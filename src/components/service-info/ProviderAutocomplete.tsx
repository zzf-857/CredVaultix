import React from 'react'
import {
  Autocomplete,
  Box,
  TextField,
  Typography,
  type AutocompleteChangeReason,
  type AutocompleteInputChangeReason,
} from '@mui/material'
import ProviderIcon from './ProviderIcon'
import {
  MODEL_PROVIDERS,
  getProviderHostname,
  searchModelProviders,
  type ModelProvider,
} from './modelProviders'

export type ProviderAutocompleteValue = ModelProvider | string | null

export interface ProviderAutocompleteProps {
  value: ProviderAutocompleteValue
  inputValue: string
  onChange: (value: ProviderAutocompleteValue, reason: AutocompleteChangeReason) => void
  onInputChange: (value: string, reason: AutocompleteInputChangeReason) => void
  options?: readonly ModelProvider[]
  label?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
  error?: boolean
  helperText?: React.ReactNode
}

export default function ProviderAutocomplete({
  value,
  inputValue,
  onChange,
  onInputChange,
  options = MODEL_PROVIDERS,
  label = '模型厂商',
  placeholder = '搜索厂商名称、别名或域名',
  disabled = false,
  required = false,
  autoFocus = false,
  error = false,
  helperText,
}: ProviderAutocompleteProps) {
  return (
    <Autocomplete<ModelProvider, false, false, true>
      freeSolo
      autoHighlight
      selectOnFocus
      clearOnBlur={false}
      handleHomeEndKeys
      options={[...options]}
      value={value}
      inputValue={inputValue}
      disabled={disabled}
      onChange={(_event, nextValue, reason) => onChange(nextValue, reason)}
      onInputChange={(_event, nextInputValue, reason) => onInputChange(nextInputValue, reason)}
      filterOptions={(availableOptions, state) => searchModelProviders(state.inputValue, availableOptions)}
      getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
      isOptionEqualToValue={(option, selectedValue) => option.id === selectedValue.id}
      renderOption={(optionProps, option) => {
        const hostname = getProviderHostname(option.baseUrl)
        return (
          <Box
            component="li"
            {...optionProps}
            key={option.id}
            sx={{
              ...optionProps.style,
              display: 'grid !important',
              gridTemplateColumns: '32px minmax(0, 1fr)',
              alignItems: 'center',
              gap: 1,
              minHeight: 48,
            }}
          >
            <ProviderIcon provider={option} size={32} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                {option.name}
              </Typography>
              {hostname && (
                <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary' }}>
                  {hostname}
                </Typography>
              )}
            </Box>
          </Box>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          fullWidth
          label={label}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          error={error}
          helperText={helperText}
          inputProps={{
            ...params.inputProps,
            'aria-label': label,
          }}
        />
      )}
    />
  )
}
