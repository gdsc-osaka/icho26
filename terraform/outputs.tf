output "d1_database_id" {
  description = "D1 database UUID — copy into wrangler.toml `database_id`."
  value       = cloudflare_d1_database.icho26.id
}

output "kv_namespace_id" {
  description = "KV namespace ID — copy into wrangler.toml KV `id`."
  value       = cloudflare_workers_kv_namespace.cache.id
}
