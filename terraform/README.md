# Terraform — Cloudflare infrastructure

Manages D1 + KV namespace via the Cloudflare provider.
See `../specs/05-ci-deploy.md` §2 for the design rationale.

## First-time setup

D1 and KV were created by `pnpm wrangler d1 create` /
`pnpm wrangler kv namespace create` before this Terraform config existed.
On first setup you must `terraform import` them into state.

```sh
cd terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars if your account_id differs

export TF_VAR_cloudflare_api_token='cf-token-with-D1-and-KV-edit'

terraform init
terraform import cloudflare_d1_database.icho26 \
  <ACCOUNT_ID>/<D1_ID>
terraform import cloudflare_workers_kv_namespace.cache \
  <ACCOUNT_ID>/<KV_ID>

terraform plan   # expect: No changes.
```

The IDs are visible in `../wrangler.toml`.

## Adding new resources

1. Edit `main.tf`
2. `terraform plan`
3. `terraform apply`
4. If the new resource exposes an ID needed by the Worker, add it to
   `outputs.tf` and copy the value into `wrangler.toml`.

## State

Local state only. Do not commit `terraform.tfstate*` or `terraform.tfvars`.
Token rotation = re-export `TF_VAR_cloudflare_api_token` and re-run.
