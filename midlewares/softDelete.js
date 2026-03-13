export function applySoftDeleteMiddleware(prisma) {
  prisma.$use(async (params, next) => {

    const modelsWithSoftDelete = [
      "accounts",
      "transactions",
      "assets",
      "categories",
      "bills"
    ]

    if (!modelsWithSoftDelete.includes(params.model ?? "")) {
      return next(params)
    }

    // findMany
    if (params.action === "findMany") {
      params.args = params.args || {}
      params.args.where = {
        deleted_at: null,
        ...params.args.where
      }
    }

    // findFirst
    if (params.action === "findFirst") {
      params.args = params.args || {}
      params.args.where = {
        deleted_at: null,
        ...params.args.where
      }
    }

    // findUnique → convertimos a findFirst
    if (params.action === "findUnique") {
      params.action = "findFirst"
      params.args.where = {
        ...params.args.where,
        deleted_at: null
      }
    }

    return next(params)
  })
}