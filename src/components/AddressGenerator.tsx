import React, { useState, useEffect } from 'react'
import { Box, Typography, Button, Paper, Grid, IconButton, TextField, Tooltip, Snackbar, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import RefreshIcon from '@mui/icons-material/Refresh'
import { faker } from '@faker-js/faker/locale/en_US'
import { usStates, citiesByState } from '../utils/usLocations'

interface Identity {
  fullName: string
  gender: string
  dob: string
  ssn: string
  street: string
  city: string
  state: string
  zipCode: string
  phone: string
  email: string
  company: string
  jobTitle: string
}

export default function AddressGenerator() {
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [useRealEmail, setUseRealEmail] = useState<boolean>(true)
  
  const [selectedState, setSelectedState] = useState<string>('')
  const [selectedCity, setSelectedCity] = useState<string>('')

  const generateIdentity = async () => {
    setLoading(true)
    try {
    const sex = faker.person.sexType()
    const firstName = faker.person.firstName(sex)
    const lastName = faker.person.lastName()
    
    let targetState = selectedState
    if (!targetState) {
      targetState = faker.helpers.arrayElement(usStates).abbr
    }
    
    let targetCity = selectedCity
    const availableCities = citiesByState[targetState] || ['Unknown']
    if (!targetCity || !availableCities.includes(targetCity)) {
      targetCity = faker.helpers.arrayElement(availableCities)
    }
    
    let email = faker.internet.email({ firstName, lastName })
    if (useRealEmail) {
      try {
        const res = await fetch('https://mail.chatgpt.org.uk/api/generate-email', {
          headers: { 'X-API-Key': 'gpt-test' }
        })
        const data = await res.json()
        if (data.success && data.data?.email) {
          email = data.data.email
        }
      } catch (err) {
        console.error('Failed to fetch real temp email:', err)
      }
    }
    
    setIdentity({
      fullName: `${firstName} ${lastName}`,
      gender: sex === 'male' ? 'Male' : 'Female',
      dob: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0],
      ssn: `${faker.string.numeric(3)}-${faker.string.numeric(2)}-${faker.string.numeric(4)}`,
      street: faker.location.streetAddress(),
      city: targetCity,
      state: targetState,
      zipCode: faker.location.zipCode({ state: targetState }),
      phone: faker.phone.number({ style: 'national' }),
      email,
      company: faker.company.name(),
      jobTitle: faker.person.jobTitle(),
    })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    generateIdentity()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStateChange = (newVal: string) => {
    setSelectedState(newVal)
    setSelectedCity('') // Reset city when state changes
  }

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const renderField = (label: string, value: string, sm: number = 6) => (
    <Grid item xs={12} sm={sm}>
      <TextField
        fullWidth
        label={label}
        value={value}
        InputProps={{
          readOnly: true,
          endAdornment: (
            <Tooltip title={copiedField === label ? "已复制" : "复制"}>
              <IconButton 
                size="small" 
                onClick={() => handleCopy(value, label)}
                color={copiedField === label ? "success" : "default"}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ),
        }}
        variant="outlined"
        size="small"
      />
    </Grid>
  )

  if (!identity) return null

  return (
    <Box sx={{ p: 4, flex: 1, display: 'flex', justifyContent: 'center', overflowY: 'auto' }}>
      <Box sx={{ maxWidth: 850, width: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>美国随机身份生成器</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>州 (State)</InputLabel>
              <Select
                value={selectedState}
                label="州 (State)"
                onChange={(e) => handleStateChange(e.target.value)}
              >
                <MenuItem value=""><em>系统随机选用</em></MenuItem>
                {usStates.map(st => (
                  <MenuItem key={st.abbr} value={st.abbr}>{st.name} ({st.abbr})</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 140 }} disabled={!selectedState}>
              <InputLabel>城市 (City)</InputLabel>
              <Select
                value={selectedCity}
                label="城市 (City)"
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                <MenuItem value=""><em>同州内随机</em></MenuItem>
                {selectedState && citiesByState[selectedState]?.map(city => (
                  <MenuItem key={city} value={city}>{city}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button 
              variant="contained" 
              startIcon={<RefreshIcon />}
              onClick={generateIdentity}
              disabled={loading}
              sx={{ borderRadius: 2 }}
            >
              换一个 (Generate)
            </Button>
          </Box>
        </Box>

        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: 'primary.main' }}>基本信息 (Basic Info)</Typography>
          <Grid container spacing={2}>
            {renderField('全名 (Full Name)', identity.fullName, 6)}
            {renderField('性别 (Gender)', identity.gender, 3)}
            {renderField('出生日期 (DOB)', identity.dob, 3)}
            {renderField('社会安全码 (SSN)', identity.ssn, 4)}
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                label="电子邮箱 (Email)"
                value={identity.email}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Tooltip title="勾选后生成真实可收信的临时邮箱，否则使用本地随机假数据">
                        <FormControlLabel
                          control={<Switch size="small" checked={useRealEmail} onChange={(e) => setUseRealEmail(e.target.checked)} color="primary" />}
                          label={<Typography variant="caption" sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>真实邮箱</Typography>}
                          sx={{ m: 0, mr: 1 }}
                        />
                      </Tooltip>
                      <Tooltip title={copiedField === '电子邮箱 (Email)' ? "已复制" : "复制"}>
                        <IconButton 
                          size="small" 
                          onClick={() => handleCopy(identity.email, '电子邮箱 (Email)')}
                          color={copiedField === '电子邮箱 (Email)' ? "success" : "default"}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ),
                }}
                variant="outlined"
                size="small"
              />
            </Grid>
            {renderField('电话号码 (Phone)', identity.phone, 6)}
          </Grid>
        </Paper>

        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: 'primary.main' }}>地址信息 (Address Info)</Typography>
          <Grid container spacing={2}>
            {renderField('街道 (Street)', identity.street, 12)}
            {renderField('城市 (City)', identity.city, 4)}
            {renderField('州 (State)', identity.state, 4)}
            {renderField('邮编 (Zip Code)', identity.zipCode, 4)}
          </Grid>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              size="small" 
              onClick={() => handleCopy(`${identity.street}, ${identity.city}, ${identity.state} ${identity.zipCode}`, '完整地址')}
              sx={{ textTransform: 'none' }}
            >
              一键复制完整地址
            </Button>
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: 'primary.main' }}>职业信息 (Work Info)</Typography>
          <Grid container spacing={2}>
            {renderField('公司名称 (Company)', identity.company, 6)}
            {renderField('职位 (Job Title)', identity.jobTitle, 6)}
          </Grid>
        </Paper>
      </Box>

      <Snackbar
        open={!!copiedField}
        message={`已复制: ${copiedField}`}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        autoHideDuration={2000}
        onClose={() => setCopiedField(null)}
      />
    </Box>
  )
}
