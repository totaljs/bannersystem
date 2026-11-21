mkdir -p .bundle

cd .bundle
cp -a ../controllers/ controllers
cp -a ../definitions/ definitions
cp -a ../modules/ modules
cp -a ../plugins/ plugins
cp -a ../public/ public
cp -a ../views/ views

# The bundler of total5 writes a relative file name next to its own CLI, so the path is absolute
# and outside the bundled folder
cd ..
(cd .bundle && total5 --bundle "$(cd .. && pwd)/--bundles--/app.bundle")

rm -rf .bundle
echo "DONE"
