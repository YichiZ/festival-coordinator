resource "aws_secretsmanager_secret" "app" {
  for_each = var.secrets

  name = "festival-coordinator/${var.env}/${each.key}"
}

resource "aws_secretsmanager_secret_version" "app" {
  for_each = var.secrets

  secret_id     = aws_secretsmanager_secret.app[each.key].id
  secret_string = each.value
}
