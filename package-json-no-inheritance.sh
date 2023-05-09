echo --- START package.json does not support inheritance
echo --- In  the first project, a super directory package.json has type=module
echo --- but the sub directory package.json does not have type=module
echo --- The result is a run time exception pointing to the fact the .js module loading
echo --- is inconsistent.
echo
node src/package-json/no-inheritance-fail/sub-package/esm-import.js
echo ---
echo --- The second project adds type=module to the sub directory package.json
echo --- The result is a pass with code properly running
echo
node src/package-json/no-inheritance-pass/sub-package/esm-import.js
echo
echo --- END package.json does not support inheritance
echo
echo
