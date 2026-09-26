provider "aws" {
  region = var.region

  # Tag everything so it's easy to find (and bill-track) in the console.
  default_tags {
    tags = {
      Project   = "bs-kara"
      ManagedBy = "terraform"
    }
  }
}

# ---- Lookups (read-only) ------------------------------------------------------

# Every account has a default VPC (private network) per region; we use it
# instead of building our own network in Phase 1.
data "aws_vpc" "default" {
  default = true
}

# Latest Ubuntu 24.04 ARM image, published by Canonical.
data "aws_ssm_parameter" "ubuntu_arm64" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id"
}

# ---- SSH key ------------------------------------------------------------------

resource "aws_key_pair" "admin" {
  key_name   = "bs-kara-admin"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

# ---- Firewall (security group) ------------------------------------------------

resource "aws_security_group" "web" {
  name        = "bs-kara-web"
  description = "bs-kara web server: HTTP/HTTPS from anywhere, SSH from ssh_cidrs"
  vpc_id      = data.aws_vpc.default.id
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = aws_security_group.web.id
  description       = "HTTP - Caddy redirects to HTTPS and answers Lets Encrypt checks"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.web.id
  description       = "HTTPS"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  for_each = toset(var.ssh_cidrs)

  security_group_id = aws_security_group.web.id
  description       = "SSH"
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.web.id
  description       = "Outbound: apt, Docker image pulls, external APIs"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# ---- Server -------------------------------------------------------------------

resource "aws_instance" "web" {
  ami                    = data.aws_ssm_parameter.ubuntu_arm64.value
  instance_type          = var.instance_type
  key_name               = aws_key_pair.admin.key_name
  vpc_security_group_ids = [aws_security_group.web.id]

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  # Require IMDSv2 (session tokens) for the instance metadata endpoint.
  metadata_options {
    http_tokens = "required"
  }

  tags = {
    Name = "bs-kara-web"
  }

  # A newer Ubuntu image must not silently replace a running server.
  lifecycle {
    ignore_changes = [ami]
  }
}

# Fixed public IP that survives stop/start, so DNS can point at it.
resource "aws_eip" "web" {
  instance = aws_instance.web.id
  domain   = "vpc"

  tags = {
    Name = "bs-kara-web"
  }
}
