export function getCurrentUser(req, res) {
  res.json({
    user: {
      uid: req.user.uid,
      email: req.user.email || "",
      name: req.user.name || "",
      picture: req.user.picture || "",
      firebase: {
        signInProvider: req.user.firebase?.sign_in_provider || ""
      }
    }
  });
}
