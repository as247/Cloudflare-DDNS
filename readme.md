# Cloudflare Dynamic DNS

### Edit cfupdater.sh
```shell
authToken="----------------------------------------"    # Top right corner, "My profile" > API Tokens > "Global API Key"
zoneIdentifier="--------------------------------"       # Can be found in the "Overview" tab of your domain
recordName="home.yourdomain.com"                        # Which record you want to be synced
```

### Create cronjob to run every minute
```shell
* * * * * bash /path/to/cfupdater.sh
```