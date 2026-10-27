export function healthCheck(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      status: "ok",
      service: "highglen-school-platform",
      timestamp: new Date().toISOString(),
    },
  });
}
