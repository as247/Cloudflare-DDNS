#!/bin/bash
# By As247
# CHANGE THESE
authToken="----------------------------------------"    # Top right corner, "My profile" > "Global API Key"
zoneIdentifier="--------------------------------"       # Can be found in the "Overview" tab of your domain
recordName="home.yourdomain.com"                        # Which record you want to be synced
ttl=120
proxied=false
refetchRecordTimeout=600                         # Fetch cache

# DO NOT CHANGE LINES BELOW
scriptPath=`readlink -f "$0"`
ipFile="$scriptPath.cache";

getRecord(){
	if [ -f $ipFile ]; then
		local now=`date +%s`
		local lastmodified=`stat $ipFile -c %Y`
		local diff=$(($now - $lastmodified))
		if [ $diff -lt $refetchRecordTimeout ]; then
			record=$(cat $ipFile)
			if [ -n "$record" ]; then
				echo "$record"
				return 0
			fi
			
		fi
	fi
	
	record=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$zoneIdentifier/dns_records?name=$recordName" -H "Authorization: Bearer $authToken"  -H "Content-Type: application/json")
	if [ $? -gt 0 ]; then
		echo "$record";
		return 1
	fi
	if [ -z "$record" ]; then
		return 1;
	fi
	if [ $(echo "$record" | grep -c '"success":false') -gt 0 ]; then
		echo "$record";
		return 1;
	fi
	echo $record > $ipFile
	echo $record
}
getRecordId(){
	local record
	record=$(getRecord)
	if [ $? -gt 0 ]; then
		echo "$record"
		return 1;
	fi
	if [ $(echo "$record" | grep -c '"success":false') -gt 0 ]; then
		echo $record;
		return 1;
	fi
	echo "$record" | grep -Po '(?<="id":")[^"]*' | head -1
}
getCurrentIp(){
	local record
	record=$(getRecord)
	if [ $? -gt 0 ]; then
		echo "$record"
		return 1;
	fi
	if [ $(echo "$record" | grep -c '"success":false') -gt 0 ]; then
		echo "$record";
		return 1;
	fi
	
	echo "$record" | grep -Po '(?<="content":")[^"]*' | head -1
}

# SCRIPT START
echo "[Cloudflare DDNS] Initiated"
echo "[Cloudflare DDNS] Looking for current ip address using icanhazip.com"
ip=$(curl -s https://ipv4.icanhazip.com/)
if [ -z $ip ]; then
	echo "[Cloudflare DDNS] Could not solve ip with icanhazip.com try again with ipify.org"
	ip=$(curl -s https://api.ipify.org/)
fi
if [ -z $ip ]; then
	echo "[Cloudflare DDNS] Could not solve ip with ipify.org try again with seeip.org"
	ip=$(curl -s https://ip4.seeip.org/)
fi
if [ -z $ip ]; then
	>&2 echo "[Cloudflare DDNS] Not able to get current ip address"
	exit 1
fi

echo "[Cloudflare DDNS] Your ip address: $ip"

data="{\"type\":\"A\",\"proxied\":$proxied,\"ttl\":$ttl,\"name\":\"$recordName\",\"content\":\"$ip\"}"
old_ip=$(getCurrentIp)

if [ $? -gt 0 ]; then
	>&2 echo -e "[Cloudflare DDNS] Error while getting current Cloudflare record. DUMPING RESULTS:\n$old_ip"
	exit 1;
fi
#exit;
if [ -z "$old_ip" ]; then
	
  echo "[Cloudflare DDNS] Record does not exist, Creating..."
  create=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$zoneIdentifier/dns_records/$record_identifier" -H "Authorization: Bearer $authToken" -H "Content-Type: application/json" --data "$data")
  if [[ $create == *"\"success\":false"* ]]; then
	>&2 echo -e "[Cloudflare DDNS] Create failed for $recordName => $ip. DUMPING RESULTS:\n$create"
	exit 1
  fi
  echo "[Cloudflare DDNS] $recordName created with IP '$ip'."
  echo "$create" > $ipFile
  exit 0
fi

# Set existing IP address from the fetched record


# Compare if they're the same
if [ "$ip" == "$old_ip" ]; then
  echo "[Cloudflare DDNS] IP has not changed."
  exit 0
fi

# Set the record identifier from result
record_identifier=$(getRecordId)
echo "[Cloudflare DDNS] Update $old_ip => $ip"
# The execution of update
update=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$zoneIdentifier/dns_records/$record_identifier" -H "Authorization: Bearer $authToken" -H "Content-Type: application/json" --data "$data")

# The moment of truth
case "$update" in
*"\"success\":false"*)
  >&2 echo -e "[Cloudflare DDNS] Update failed for $record_identifier. DUMPING RESULTS:\n$update"
  exit 1;;
*)
  echo "[Cloudflare DDNS] IPv4 context '$ip' has been synced to Cloudflare.";;
esac
echo "$update" > $ipFile

