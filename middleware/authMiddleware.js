module.exports = (req, res, next) => {
  if (req.session.userId) {
    // إذا كان userId موجودًا في الجلسة، يسمح للمستخدم بمتابعة الطلب
    next();
  } else {
    // إعادة توجيه المستخدم إلى صفحة تسجيل الدخول في حالة عدم تسجيل الدخول
    res.redirect("/login");
  }
};
