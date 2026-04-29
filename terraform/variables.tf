variable "account_id" {
  description = "Cloudflare Account ID. Public information; safe to commit via terraform.tfvars."
  type        = string
}

variable "cloudflare_api_token" {
  description = <<EOT
Cloudflare API token with permissions:
  - Account / D1 — Edit
  - Account / Workers KV Storage — Edit
  - Account / Account Settings — Read
Pass via `TF_VAR_cloudflare_api_token` env var; never commit it.
EOT
  type        = string
  sensitive   = true
}
