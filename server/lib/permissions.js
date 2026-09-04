// Categories used to be a fixed list here. They now live in the
// `categories` table (see server/lib/categories.js) so admins can add their
// own from the UI - kept out of this file to avoid a stale duplicate.
const MAX_RANGE_DAYS = 120;
const MAX_RECUR_WEEKS = 52;

function isAdmin(user) {
  return !!user && user.role === "admin";
}

// Can this user create shifts at all right now?
function canCreate(user) {
  if (!user) return false;
  if (user.role !== "admin" && user.viewOnly) return false;
  return true;
}

// Can this user create/edit a shift for the given person's group?
// (admins: any group; implantacao: only implantacao-group people; usuario: any
// person, but see canManageShift for edit/delete restriction to their own entries)
function canCreateForGroup(user, personGroup) {
  if (!canCreate(user)) return false;
  if (user.role === "implantacao") return personGroup === "implantacao";
  return true;
}

// Can this user edit/delete this specific existing shift?
function canManageShift(user, shift, personGroup) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.viewOnly) return false;
  if (user.role === "implantacao") return personGroup === "implantacao";
  if (user.role === "usuario") return !!shift.created_by && shift.created_by === user.email;
  return false;
}

module.exports = {
  MAX_RANGE_DAYS,
  MAX_RECUR_WEEKS,
  isAdmin,
  canCreate,
  canCreateForGroup,
  canManageShift,
};
