#cd /project/site && npm i -g next
cp /configs/next.config.js.template /project/site/next.config.js

do-default

time su -c "cd /project && npm run build" fo
