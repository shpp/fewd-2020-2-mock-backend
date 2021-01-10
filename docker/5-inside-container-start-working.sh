#nginx -g 'daemon off;' &

cd /project
#ln -s /configs ./configs

#DISCORDJSON=/storage/discord.json
npm run build && echo "STARTING" && node build/index.js 2>&1 | tee -a /storage/logs.txt

