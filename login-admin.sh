#!/bin/bash
# dev OTP: server logs code when SMTP off
curl -s -X POST http://localhost:8787/api/admin/login/start -H 'Content-Type: application/json' -d '{"email":"admin@starttechpro.ru"}' -c /tmp/qf-cookies.txt
