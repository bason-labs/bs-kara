variable "region" {
  description = "AWS region for the server."
  type        = string
  default     = "ap-southeast-1" # Singapore
}

variable "instance_type" {
  description = "EC2 size. t4g = ARM (Graviton). Resize to t4g.medium if 2 GB RAM runs short."
  type        = string
  default     = "t4g.small"
}

variable "ssh_public_key_path" {
  description = "Public half of the SSH key allowed to log in as ubuntu."
  type        = string
  default     = "~/.ssh/bs-kara.pub"
}

variable "ssh_cidrs" {
  description = "Who may reach port 22. Your IP as [\"x.x.x.x/32\"]; widened in step 7 for CI."
  type        = list(string)
}
