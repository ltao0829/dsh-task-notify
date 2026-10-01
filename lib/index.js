//#region src/index.ts
/** Stable cordis plugin name (matches the cordis.patch.yml insert id). */
const name = "task-notify";
/** No required host services. */
const inject = [];
/**
* Host entrypoint retained for the DSH bundle loader.
* @param _ctx - host plugin context (unused).
*/
function apply(_ctx) {}
//#endregion
export { apply, inject, name };
