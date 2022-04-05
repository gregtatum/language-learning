Run it:

```
node src/hunspell.js data/duolingo-5.txt
node src/natural.js
```

# Update dictionaries

```
rm -rf ./dictionaries
git clone git@github.com:wooorm/dictionaries.git repo
cp -r repo/dictionaries .
rem -rf repo
```
