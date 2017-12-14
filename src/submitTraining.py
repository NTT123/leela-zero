import time
for _ in range(10000000000000000000000):
    from os import system

    system('curl "https://docs.google.com/spreadsheets/d/18LEHJzJ9H5HnIFNZL4Mf8H1HtQGvWX4KikHQJs8hXgc/export?format=csv&id=18LEHJzJ9H5HnIFNZL4Mf8H1HtQGvWX4KikHQJs8hXgc&gid=1059658649" -o games.csv')

    f = open("games.csv", "r")


    system('curl "http://zero.sjeng.org/" -o network.txt')
    net = open("network.txt", "r").read()
    hashes = [l[0:64] for l in net.split("/networks/")[1:] if l[64:67] == ".gz"]
    print(hashes)

    txt = f.read()

    from datetime import datetime
    from dateutil.parser import parse

    import uuid
    import hashlib

    def hash_password(password):
        # uuid is used to generate a random number
        return hashlib.sha256(password.encode()).hexdigest()


    def getTime(t):
        return parse(t)

    def lastHash():
        return open("lastHash.txt", "r").read()


    lastH = lastHash()
    h = ""

    newG = False

    def findHash(h):
        for hh in hashes:
            print (h, hh[0:8])
            if hh[0:8] == h:
                return hh
        return "Err"

    if len(lastH) == 0:
        newG = True

    for l in txt.split('"'):
        if len(l) > 5:
            if l[0] == '\n':
                t = l[1:-1]
                ti = getTime(t)
            if l[0] == '(':
                h = hash_password(l)
                if newG == False:
                    if lastH == h:
                        newG = True
                else:
                    ha = l.split(" ")[3][0:8]
                    v = l.split(" ")[2]
                    has = findHash(ha)
                    if has == "Err":
                        continue
                    fg = open("game.sgf", "w")
                    fg.write(l)
                    fg.close()
                    print(l)
                    system("rm -f game.sgf.gz")
                    system("rm -f training.0.gz")
                    system("cat game.inp | ./leelaz -g -q -w 92c658d7325fe38f0c8adbbb1444ed17afd891b9f208003c272547a7bcb87909")
                    system("gzip game.sgf")
                    cmd = "curl"
                    cmd = cmd + " -F networkhash=" + has
                    cmd = cmd + " -F clientversion=8"
                    cmd = cmd + " -F sgf=@game.sgf.gz"
                    cmd = cmd + " -F trainingdata=@training.0.gz"
                    cmd = cmd + " http://zero.sjeng.org/submit"
                    system(cmd)
                    print(cmd)


    ff = open("lastHash.txt", "w")
    ff.write(h)
    ff.close()
    system("git add lastHash.txt")
    system("git commit -m \"update lastHash\"")
    system("git push origin submitServer")

    time.sleep(1*60) # 1 minutes
