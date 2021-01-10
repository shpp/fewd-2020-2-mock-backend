#do-default

fo-fix-dir-ownership /project

cd /project/site && time su -c "cd /project/site && npm install --loglevel verbose" fo
