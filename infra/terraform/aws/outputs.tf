output "public_ip" {
  description = "Elastic IP of the server."
  value       = aws_eip.web.public_ip
}

output "sslip_host" {
  description = "Free hostname that resolves to the IP (used until the real domain)."
  value       = "${replace(aws_eip.web.public_ip, ".", "-")}.sslip.io"
}

output "ssh_command" {
  description = "Log in to the server."
  value       = "ssh -i ~/.ssh/bs-kara ubuntu@${aws_eip.web.public_ip}"
}
