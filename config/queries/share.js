function selectShareDirWithDep(dep_id) {
    const sql = `SELECT * FROM lxm_file_share WHERE with_dep_id = ${dep_id} AND is_delete = 0`
    return sql
}

function selectShareDirWithJob(job_id) {
    const sql = `SELECT * FROM lxm_file_share WHERE with_job_id = ${job_id} AND is_delete = 0`
    return sql
}

function selectShareDirWithUser(uid) {
    const sql = `SELECT * FROM lxm_file_share WHERE with_uid = '${uid}' AND is_delete = 0`
    return sql
}

function selectShareDirWithDirAndDep(dir_id, dep_id) {
    const sql = `SELECT * FROM lxm_file_share WHERE dir_id = '${dir_id}' AND with_dep_id = ${dep_id} AND is_delete = 0`
    return sql
}

function selectShareDirWithDirAndJob(dir_id, job_id) {
    const sql = `SELECT * FROM lxm_file_share WHERE dir_id = '${dir_id}' AND with_job_id = ${job_id} AND is_delete = 0`
    return sql
}

function selectShareDirWithDirAndUser(dir_id, uid) {
    const sql = `SELECT * FROM lxm_file_share WHERE dir_id = '${dir_id}' AND with_uid = '${uid}' AND is_delete = 0`
    return sql
}

function selectShareDirFromUid(uid) {
    const sql = `SELECT * FROM lxm_file_share WHERE uid = '${uid}' AND is_delete = 0`
    return sql
}

function addShareDirWithDep(values) {
    const sql = `INSERT INTO lxm_file_share (
        uid,
        dir_id,
        with_dep_id,
        perms_upload,
        perms_download,
        perms_update,
        perms_delete
    ) VALUES (
        '${values.uid}',
        '${values.dir_id}',
        '${values.with_dep_id}',
        '${values.perms_upload}',
        '${values.perms_download}',
        '${values.perms_update}',
        '${values.perms_delete}'
    )`
    return sql
}

function addShareDirWithJob(values) {
    const sql = `INSERT INTO lxm_file_share (
        uid,
        dir_id,
        with_job_id,
        perms_upload,
        perms_download,
        perms_update,
        perms_delete
    ) VALUES (
        '${values.uid}',
        '${values.dir_id}',
        '${values.with_job_id}',
        '${values.perms_upload}',
        '${values.perms_download}',
        '${values.perms_update}',
        '${values.perms_delete}'
    )`
    return sql
}

function addShareDirWithUser(values) {
    const sql = `INSERT INTO lxm_file_share (
        uid,
        dir_id,
        with_uid,
        perms_upload,
        perms_download,
        perms_update,
        perms_delete
    ) VALUES (
        '${values.uid}',
        '${values.dir_id}',
        '${values.with_uid}',
        '${values.perms_upload}',
        '${values.perms_download}',
        '${values.perms_update}',
        '${values.perms_delete}'
    )`
    return sql
}

function addShareFileWithDep(values) {
    const sql = `INSERT INTO lxm_file_share (
        uid,
        file_id,
        with_dep_id,
        perms_upload,
        perms_download,
        perms_update,
        perms_delete
    ) VALUES (
        '${values.uid}',
        '${values.file_id}',
        '${values.with_dep_id}',
        '${values.perms_upload}',
        '${values.perms_download}',
        '${values.perms_update}',
        '${values.perms_delete}'
    )`
    return sql
}

function addShareFileWithJob(values) {
    const sql = `INSERT INTO lxm_file_share (
        uid,
        file_id,
        with_job_id,
        perms_upload,
        perms_download,
        perms_update,
        perms_delete
    ) VALUES (
        '${values.uid}',
        '${values.file_id}',
        '${values.with_job_id}',
        '${values.perms_upload}',
        '${values.perms_download}',
        '${values.perms_update}',
        '${values.perms_delete}'
    )`
    return sql
}

function addShareFileWithUser(values) {
    const sql = `INSERT INTO lxm_file_share (
        uid,
        file_id,
        with_uid,
        perms_upload,
        perms_download,
        perms_update,
        perms_delete
    ) VALUES (
        '${values.uid}',
        '${values.file_id}',
        '${values.with_uid}',
        '${values.perms_upload}',
        '${values.perms_download}',
        '${values.perms_update}',
        '${values.perms_delete}'
    )`
    return sql
}

module.exports = {
    selectShareDirWithDep,
    selectShareDirWithJob,
    selectShareDirWithUser,
    selectShareDirWithDirAndDep,
    selectShareDirWithDirAndJob,
    selectShareDirWithDirAndUser,
    selectShareDirFromUid,
    addShareDirWithDep,
    addShareDirWithJob,
    addShareDirWithUser,
    addShareFileWithDep,
    addShareFileWithJob,
    addShareFileWithUser
}