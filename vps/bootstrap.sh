#!/bin/bash
# Первый запуск на новом VPS (Ubuntu 24.04), одной командой из веб-консоли Бегета:
#   curl -fsSL https://lutenkovadim123-rgb.github.io/nikmoyka-demo/vps/bootstrap.sh | sudo bash
#   если github.io недоступен из сети сервера (так бывает в РФ):
#   curl -fsSL https://raw.githubusercontent.com/lutenkovadim123-rgb/nikmoyka-demo/main/b | bash
# Что делает: ставит git, создаёт ключ только для чтения репозитория, ждёт, пока его добавят в GitHub,
# забирает код из ветки production и запускает setup.sh и первую выкладку. Дальше сервер сам забирает обновления.
set -euo pipefail
REPO=git@github.com:lutenkovadim123-rgb/nikmoyka.git
BR=production
[ "$(id -u)" = 0 ] || { echo "Запустите через sudo"; exit 1; }
apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git openssh-client >/dev/null
install -d -m 700 /root/.ssh
KEY=/root/.ssh/nikmoyka_deploy
[ -f $KEY ] || ssh-keygen -t ed25519 -N '' -C "nikmoyka-vps-deploy" -f $KEY >/dev/null
cat > /root/.ssh/config <<CFG
Host github.com
  # SSH через порт 443: работает и там, где порт 22 закрыт
  Hostname ssh.github.com
  Port 443
  IdentityFile $KEY
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
CFG
chmod 600 /root/.ssh/config
echo
echo "================================================================"
echo " Добавьте этот ключ в GitHub: репозиторий nikmoyka → Settings →"
echo " Deploy keys → Add deploy key. Название: VPS. «Allow write» НЕ ставить."
echo
cat $KEY.pub
echo "================================================================"
# ключ также открывается в браузере: http://IP/key.txt — удобно, если консоль не даёт копировать текст
IP=$(curl -fsS4 --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
mkdir -p /tmp/nikmoyka-key && cp $KEY.pub /tmp/nikmoyka-key/key.txt
if ! ss -ltn | grep -q ':80 '; then (cd /tmp/nikmoyka-key && exec python3 -m http.server 80 >/dev/null 2>&1) & KEYSRV=$!; fi
echo "Ключ можно скопировать и из браузера: http://$IP/key.txt"
echo
echo "Жду, пока ключ добавят (до 30 минут)…"
for i in $(seq 1 180); do
  if git ls-remote $REPO $BR >/dev/null 2>&1; then echo "Ключ принят."; [ -n "${KEYSRV:-}" ] && kill $KEYSRV 2>/dev/null; rm -rf /tmp/nikmoyka-key; break; fi
  sleep 10
  [ "$i" = 180 ] && { echo "Ключ так и не добавили. Запустите команду ещё раз после добавления."; exit 1; }
done
if [ -d /opt/nikmoyka/repo/.git ]; then git -C /opt/nikmoyka/repo fetch -q origin $BR && git -C /opt/nikmoyka/repo checkout -q -B $BR origin/$BR
else install -d /opt/nikmoyka && git clone -q --depth 20 -b $BR $REPO /opt/nikmoyka/repo; fi
bash /opt/nikmoyka/repo/site-redesign/server/deploy/setup.sh
FORCE=1 /usr/local/bin/nikmoyka-update
echo
echo "Готово. Сайт открывается по http://$IP/"
echo "Дальше: sudo nikmoyka-config — почта и мессенджер для уведомлений."
echo "Когда A-записи nikmoyka.ru и www укажут на $IP, HTTPS включится сам в течение нескольких минут."
