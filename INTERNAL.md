
## How to run on docker remotely
```
$(aws ecr get-login --no-include-email --region us-east-1)
docker pull 691216021071.dkr.ecr.us-east-1.amazonaws.com/trade-agent:latest
docker run -d 691216021071.dkr.ecr.us-east-1.amazonaws.com/trade-agent:latest
```