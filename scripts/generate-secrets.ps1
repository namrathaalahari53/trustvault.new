# Generates independent random secrets for local .env values.
$jwt = New-Object byte[] 48
$audit = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Fill($jwt)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($audit)
"JWT_SIGNING_KEY=$([Convert]::ToBase64String($jwt))"
"AUDIT_HMAC_KEY=$([Convert]::ToBase64String($audit))"
