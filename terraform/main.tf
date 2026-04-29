terraform {
  required_version = ">= 1.6"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# Cloudflare D1 database that backs the application.
# Existing resource was created via `wrangler d1 create icho26` and must be
# imported into Terraform state on first setup. See README for the import
# command and `specs/05-ci-deploy.md` §2.5.
resource "cloudflare_d1_database" "icho26" {
  account_id = var.account_id
  name       = "icho26"
}

# Cloudflare Workers KV namespace used as a session/cache store.
# Existing resource was created via `wrangler kv namespace create
# icho26-cache` and must also be imported on first setup.
resource "cloudflare_workers_kv_namespace" "cache" {
  account_id = var.account_id
  title      = "icho26-cache"
}
