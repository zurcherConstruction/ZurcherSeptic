const { SalesLead, LeadNote, Budget, Permit, Staff, sequelize } = require('../data');
const { Op } = require('sequelize');

const SalesLeadController = {
  
  // 📝 Crear un nuevo lead
  async createLead(req, res) {
    try {
      const {
        applicantName,
        applicantEmail,
        applicantPhone,
        propertyAddress,
        status,
        priority,
        tags,
        source,
        serviceType,
        estimatedValue,
        notes
      } = req.body;
      
      const createdBy = req.user?.id;

      // Validaciones
      if (!applicantName) {
        return res.status(400).json({ 
          error: 'El nombre del cliente es obligatorio' 
        });
      }

      // Crear el lead
      const lead = await SalesLead.create({
        applicantName: applicantName.trim(),
        applicantEmail: applicantEmail?.trim() || null,
        applicantPhone: applicantPhone?.trim() || null,
        propertyAddress: propertyAddress?.trim() || null,
        status: status || 'new',
        priority: priority || 'medium',
        tags: tags || [],
        source: source || 'website',
        serviceType: serviceType?.trim() || null,
        estimatedValue: estimatedValue || null,
        notes: notes?.trim() || null,
        firstContactDate: (status && status !== 'new') ? new Date() : null,
        lastActivityDate: new Date(),
        createdBy
      });

      // Cargar el lead con relaciones
      const leadWithCreator = await SalesLead.findByPk(lead.id, {
        include: [
          {
            model: Staff,
            as: 'creator',
            attributes: ['id', 'name', 'email']
          }
        ]
      });

      res.status(201).json({
        message: 'Lead creado exitosamente',
        lead: leadWithCreator
      });

    } catch (error) {
      console.error('Error al crear lead:', error);
      res.status(500).json({ 
        error: 'Error al crear el lead',
        details: error.message 
      });
    }
  },

  // � Verificar si ya existe un lead con esa dirección
  async checkLeadByAddress(req, res) {
    try {
      const { propertyAddress } = req.query;
      if (!propertyAddress?.trim()) {
        return res.status(400).json({ error: 'propertyAddress es requerida' });
      }

      const existingLead = await SalesLead.findOne({
        where: { propertyAddress: propertyAddress.trim() },
        attributes: ['id', 'applicantName', 'applicantPhone', 'status', 'priority', 'lastActivityDate']
      });

      if (!existingLead) {
        return res.status(200).json({ exists: false });
      }

      return res.status(200).json({
        exists: true,
        lead: existingLead
      });
    } catch (error) {
      console.error('Error al verificar lead por dirección:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // �📋 Listar leads con filtros y paginación
  // 🔍 Verificar duplicados de email, telefono y direccion en todo el sistema
  async checkDuplicates(req, res) {
    try {
      const { email, phone, address, excludeLeadId } = req.query;

      const result = {
        email: { found: false, matches: [] },
        phone: { found: false, matches: [] },
        address: { found: false, matches: [] },
      };

      const checks = [];

      // --- EMAIL ---
      if (email?.trim() && email.trim().length > 3) {
        const emailVal = email.trim().toLowerCase();
        checks.push(
          SalesLead.findAll({
            where: {
              applicantEmail: { [Op.iLike]: emailVal },
              ...(excludeLeadId ? { id: { [Op.ne]: excludeLeadId } } : {})
            },
            attributes: ['id', 'applicantName', 'applicantEmail', 'applicantPhone', 'propertyAddress', 'status'],
            limit: 5
          }).then(rows => {
            rows.forEach(r => result.email.matches.push({ source: 'lead', id: r.id, applicantName: r.applicantName, detail: r.propertyAddress || r.applicantPhone, status: r.status }));
          }),
          Budget.findAll({
            where: { applicantEmail: { [Op.iLike]: emailVal } },
            attributes: ['idBudget', 'applicantName', 'applicantEmail', 'propertyAddress', 'status'],
            limit: 5
          }).then(rows => {
            rows.forEach(r => result.email.matches.push({ source: 'budget', id: r.idBudget, applicantName: r.applicantName, detail: r.propertyAddress, status: r.status }));
          }),
          Permit.findAll({
            where: { applicantEmail: { [Op.iLike]: emailVal } },
            attributes: ['idPermit', 'applicantName', 'applicantEmail', 'applicantPhone', 'propertyAddress'],
            limit: 5
          }).then(rows => {
            rows.forEach(r => result.email.matches.push({ source: 'permit', id: r.idPermit, applicantName: r.applicantName, detail: r.propertyAddress || r.applicantPhone, status: null }));
          })
        );
      }

      // --- TELEFONO ---
      if (phone?.trim() && phone.trim().length > 5) {
        const phoneDigits = phone.trim().replace(/\D/g, '');
        // Comparación normalizada directamente en la BD usando REGEXP_REPLACE
        checks.push(
          SalesLead.findAll({
            where: {
              [Op.and]: [
                sequelize.where(
                  sequelize.fn('REGEXP_REPLACE', sequelize.col('SalesLead.applicant_phone'), '[^0-9]', '', 'g'),
                  { [Op.eq]: phoneDigits }
                ),
                ...(excludeLeadId ? [{ id: { [Op.ne]: excludeLeadId } }] : [])
              ]
            },
            attributes: ['id', 'applicantName', 'applicantPhone', 'applicantEmail', 'propertyAddress', 'status'],
            limit: 10
          }).then(rows => {
            rows.forEach(r => {
              result.phone.matches.push({ source: 'lead', id: r.id, applicantName: r.applicantName, detail: r.propertyAddress || r.applicantEmail, status: r.status });
            });
          }),
          Permit.findAll({
            where: sequelize.where(
              sequelize.fn('REGEXP_REPLACE', sequelize.col('Permit.applicantPhone'), '[^0-9]', '', 'g'),
              { [Op.eq]: phoneDigits }
            ),
            attributes: ['idPermit', 'applicantName', 'applicantPhone', 'propertyAddress'],
            limit: 10
          }).then(rows => {
            rows.forEach(r => {
              result.phone.matches.push({ source: 'permit', id: r.idPermit, applicantName: r.applicantName, detail: r.propertyAddress, status: null });
            });
          })
        );
      }

      // --- DIRECCION ---
      if (address?.trim() && address.trim().length > 5) {
        const addressVal = address.trim();
        checks.push(
          SalesLead.findAll({
            where: {
              propertyAddress: { [Op.iLike]: `%${addressVal}%` },
              ...(excludeLeadId ? { id: { [Op.ne]: excludeLeadId } } : {})
            },
            attributes: ['id', 'applicantName', 'applicantPhone', 'applicantEmail', 'propertyAddress', 'status'],
            limit: 5
          }).then(rows => {
            rows.forEach(r => result.address.matches.push({ source: 'lead', id: r.id, applicantName: r.applicantName, detail: r.applicantPhone || r.applicantEmail, status: r.status }));
          }),
          Budget.findAll({
            where: { propertyAddress: { [Op.iLike]: `%${addressVal}%` } },
            attributes: ['idBudget', 'applicantName', 'applicantEmail', 'propertyAddress', 'status'],
            limit: 5
          }).then(rows => {
            rows.forEach(r => result.address.matches.push({ source: 'budget', id: r.idBudget, applicantName: r.applicantName, detail: r.applicantEmail, status: r.status }));
          }),
          Permit.findAll({
            where: { propertyAddress: { [Op.iLike]: `%${addressVal}%` } },
            attributes: ['idPermit', 'applicantName', 'applicantPhone', 'propertyAddress'],
            limit: 5
          }).then(rows => {
            rows.forEach(r => result.address.matches.push({ source: 'permit', id: r.idPermit, applicantName: r.applicantName, detail: r.applicantPhone, status: null }));
          })
        );
      }

      await Promise.all(checks);

      result.email.found = result.email.matches.length > 0;
      result.phone.found = result.phone.matches.length > 0;
      result.address.found = result.address.matches.length > 0;

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error al verificar duplicados:', error);
      res.status(500).json({ error: error.message });
    }
  },
  async getLeads(req, res) {
    try {
      const {
        page = 1,
        pageSize = 20,
        status,
        priority,
        search,
        tags,
        source,
        sortBy = 'lastActivityDate',
        sortOrder = 'DESC'
      } = req.query;

      // Construir filtros
      const whereClause = {};

      if (status && status !== 'all') {
        whereClause.status = status;
      }

      if (priority && priority !== 'all') {
        whereClause.priority = priority;
      }

      if (source && source !== 'all') {
        whereClause.source = source;
      }

      if (tags) {
        // Buscar leads que contengan al menos uno de los tags
        const tagsArray = Array.isArray(tags) ? tags : [tags];
        whereClause.tags = {
          [Op.overlap]: tagsArray
        };
      }

      if (search) {
        whereClause[Op.or] = [
          { applicantName: { [Op.iLike]: `%${search}%` } },
          { applicantEmail: { [Op.iLike]: `%${search}%` } },
          { applicantPhone: { [Op.iLike]: `%${search}%` } },
          { propertyAddress: { [Op.iLike]: `%${search}%` } },
          { serviceType: { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Paginación
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      // Orden: si se pide agrupar por contacto, ordenar por la clave de grupo
      // (MIN created_at del grupo) para que los duplicados queden juntos en TODAS las páginas
      const isGroupMode = sortBy === 'contact_group';
      let orderClause;
      if (isGroupMode) {
        orderClause = [
          sequelize.literal(`(
            SELECT MIN(sl2."created_at")
            FROM "SalesLeads" sl2
            WHERE
              (sl2."applicant_email" IS NOT NULL AND sl2."applicant_email" != ''
               AND LOWER(sl2."applicant_email") = LOWER("SalesLead"."applicant_email"))
              OR
              (sl2."applicant_phone" IS NOT NULL AND sl2."applicant_phone" != ''
               AND REGEXP_REPLACE(sl2."applicant_phone", '[^0-9]', '', 'g')
                 = REGEXP_REPLACE("SalesLead"."applicant_phone", '[^0-9]', '', 'g'))
          ) ASC NULLS LAST`),
          sequelize.literal(`"SalesLead"."last_activity_date" DESC`)
        ];
      } else {
        const validSortFields = ['lastActivityDate', 'createdAt', 'applicantName', 'status', 'priority'];
        const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'lastActivityDate';
        orderClause = [[safeSortBy, sortOrder === 'ASC' ? 'ASC' : 'DESC']];
      }

      // Atributo calculado en DB: tipo de duplicado (email | phone | null)
      // Solo se calcula cuando se solicita agrupación (evita subqueries innecesarias)
      const groupTypeAttr = isGroupMode ? [
        sequelize.literal(`
          CASE
            WHEN "SalesLead"."applicant_email" IS NOT NULL
             AND "SalesLead"."applicant_email" != ''
             AND EXISTS (
               SELECT 1 FROM "SalesLeads" sl2
               WHERE LOWER(sl2."applicant_email") = LOWER("SalesLead"."applicant_email")
               AND sl2.id != "SalesLead".id
             )
            THEN 'email'
            WHEN "SalesLead"."applicant_phone" IS NOT NULL
             AND "SalesLead"."applicant_phone" != ''
             AND EXISTS (
               SELECT 1 FROM "SalesLeads" sl2
               WHERE REGEXP_REPLACE(sl2."applicant_phone", '[^0-9]', '', 'g')
                   = REGEXP_REPLACE("SalesLead"."applicant_phone", '[^0-9]', '', 'g')
               AND sl2.id != "SalesLead".id
             )
            THEN 'phone'
            ELSE NULL
          END
        `),
        'groupType'
      ] : null;

      // Consulta
      const { count, rows: leads } = await SalesLead.findAndCountAll({
        where: whereClause,
        attributes: groupTypeAttr
          ? { include: [groupTypeAttr] }
          : undefined,
        include: [
          {
            model: Staff,
            as: 'creator',
            attributes: ['id', 'name', 'email']
          },
          {
            model: Budget,
            as: 'convertedBudget',
            attributes: ['idBudget', 'propertyAddress', 'status']
          }
        ],
        order: orderClause,
        limit,
        offset
      });

      // Estadísticas
      const stats = await SalesLead.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      const statsMap = {
        new: 0,
        contacted: 0,
        interested: 0,
        quoted: 0,
        negotiating: 0,
        won: 0,
        lost: 0,
        archived: 0
      };

      stats.forEach(stat => {
        statsMap[stat.status] = parseInt(stat.count);
      });

      res.json({
        leads,
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(count / parseInt(pageSize)),
        stats: statsMap
      });

    } catch (error) {
      console.error('Error al obtener leads:', error);
      res.status(500).json({ 
        error: 'Error al obtener los leads',
        details: error.message 
      });
    }
  },

  // 🔍 Obtener un lead por ID
  async getLeadById(req, res) {
    try {
      const { id } = req.params;

      const lead = await SalesLead.findByPk(id, {
        include: [
          {
            model: Staff,
            as: 'creator',
            attributes: ['id', 'name', 'email']
          },
          {
            model: Budget,
            as: 'convertedBudget',
            attributes: ['idBudget', 'propertyAddress', 'status', 'totalAmount']
          },
          {
            model: LeadNote,
            as: 'leadNotes',
            include: [
              {
                model: Staff,
                as: 'author',
                attributes: ['id', 'name', 'email']
              }
            ],
            order: [['createdAt', 'DESC']]
          }
        ]
      });

      if (!lead) {
        return res.status(404).json({ 
          error: 'Lead no encontrado' 
        });
      }

      res.json({ lead });

    } catch (error) {
      console.error('Error al obtener lead:', error);
      res.status(500).json({ 
        error: 'Error al obtener el lead',
        details: error.message 
      });
    }
  },

  // ✏️ Actualizar un lead
  async updateLead(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const lead = await SalesLead.findByPk(id);
      
      if (!lead) {
        return res.status(404).json({ 
          error: 'Lead no encontrado' 
        });
      }

      // Si cambia a cualquier estado que NO sea 'new' y no tiene firstContactDate, establecerla
      // Esto incluye 'archived' porque significa que se contactó (ej: llamó y dijo no)
      const CONTACTED_STATUSES = ['contacted', 'interested', 'quoted', 'negotiating', 'won', 'lost', 'archived'];
      if (updates.status && CONTACTED_STATUSES.includes(updates.status) && !lead.firstContactDate) {
        updates.firstContactDate = new Date();
      }

      // Actualizar lastActivityDate
      updates.lastActivityDate = new Date();

      await lead.update(updates);

      // Recargar con relaciones
      const updatedLead = await SalesLead.findByPk(id, {
        include: [
          {
            model: Staff,
            as: 'creator',
            attributes: ['id', 'name', 'email']
          },
          {
            model: Budget,
            as: 'convertedBudget',
            attributes: ['idBudget', 'propertyAddress', 'status']
          }
        ]
      });

      res.json({
        message: 'Lead actualizado exitosamente',
        lead: updatedLead
      });

    } catch (error) {
      console.error('Error al actualizar lead:', error);
      res.status(500).json({ 
        error: 'Error al actualizar el lead',
        details: error.message 
      });
    }
  },

  // 🗑️ Archivar un lead
  async archiveLead(req, res) {
    try {
      const { id } = req.params;

      const lead = await SalesLead.findByPk(id);
      
      if (!lead) {
        return res.status(404).json({ 
          error: 'Lead no encontrado' 
        });
      }

      await lead.update({ 
        status: 'archived',
        lastActivityDate: new Date()
      });

      res.json({
        message: 'Lead archivado exitosamente',
        lead
      });

    } catch (error) {
      console.error('Error al archivar lead:', error);
      res.status(500).json({ 
        error: 'Error al archivar el lead',
        details: error.message 
      });
    }
  },

  // ❌ Eliminar permanentemente un lead (hard delete)
  async deleteLead(req, res) {
    try {
      const { id } = req.params;

      const lead = await SalesLead.findByPk(id);
      
      if (!lead) {
        return res.status(404).json({ 
          error: 'Lead no encontrado' 
        });
      }

      // Guardar info antes de eliminar para el log
      const leadInfo = {
        id: lead.id,
        customerName: lead.customerName,
        phone: lead.phone,
        status: lead.status
      };

      // Eliminar permanentemente (las notas se eliminan en cascada si está configurado)
      await lead.destroy();

      console.log('🗑️ Lead eliminado permanentemente:', leadInfo);

      res.json({
        message: 'Lead eliminado permanentemente',
        deletedLead: leadInfo
      });

    } catch (error) {
      console.error('Error al eliminar lead:', error);
      res.status(500).json({ 
        error: 'Error al eliminar el lead',
        details: error.message 
      });
    }
  },

  // 🔄 Convertir lead a presupuesto
  async convertToBudget(req, res) {
    try {
      const { id } = req.params;
      const { budgetData } = req.body;

      const lead = await SalesLead.findByPk(id);
      
      if (!lead) {
        return res.status(404).json({ 
          error: 'Lead no encontrado' 
        });
      }

      if (lead.status === 'won' && lead.convertedToBudgetId) {
        return res.status(400).json({ 
          error: 'Este lead ya fue convertido a presupuesto',
          budgetId: lead.convertedToBudgetId
        });
      }

      // Crear el presupuesto con los datos del lead
      const budget = await Budget.create({
        propertyAddress: lead.propertyAddress || '',
        clientName: lead.applicantName,
        clientEmail: lead.applicantEmail,
        clientPhone: lead.applicantPhone,
        status: budgetData?.status || 'draft',
        ...budgetData
      });

      // Actualizar el lead
      await lead.update({
        status: 'won',
        convertedToBudgetId: budget.idBudget,
        conversionDate: new Date(),
        lastActivityDate: new Date()
      });

      // Crear una nota automática
      await LeadNote.create({
        leadId: lead.id,
        staffId: req.user?.id,
        message: `✅ Lead convertido a presupuesto #${budget.idBudget}`,
        noteType: 'status_change',
        priority: 'medium',
        relatedStatus: 'won'
      });

      res.json({
        message: 'Lead convertido exitosamente a presupuesto',
        lead,
        budget
      });

    } catch (error) {
      console.error('Error al convertir lead:', error);
      res.status(500).json({ 
        error: 'Error al convertir el lead a presupuesto',
        details: error.message 
      });
    }
  },

  // � Obtener leads sin teléfono ni email
  async getNoContactLeads(req, res) {
    try {
      const leads = await SalesLead.findAll({
        where: {
          [Op.and]: [
            { [Op.or]: [{ applicantPhone: null }, { applicantPhone: '' }] },
            { [Op.or]: [{ applicantEmail: null }, { applicantEmail: '' }] }
          ]
        },
        attributes: ['id', 'applicantName', 'propertyAddress', 'status', 'createdAt', 'source'],
        order: [['createdAt', 'DESC']]
      });
      res.json({ leads, count: leads.length });
    } catch (error) {
      console.error('Error al obtener leads sin contacto:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // 🗑️ Eliminar en lote leads sin teléfono ni email
  async deleteNoContactLeads(req, res) {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Se requiere un array de IDs' });
      }
      // Validar que sean UUIDs válidos para evitar inyección
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validIds = ids.filter(id => uuidRegex.test(id));
      if (validIds.length === 0) {
        return res.status(400).json({ error: 'No se encontraron IDs válidos' });
      }
      await LeadNote.destroy({ where: { leadId: { [Op.in]: validIds } } });
      const deleted = await SalesLead.destroy({ where: { id: { [Op.in]: validIds } } });
      res.json({ message: `${deleted} leads eliminados exitosamente`, deletedCount: deleted });
    } catch (error) {
      console.error('Error al eliminar leads sin contacto:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // 📈 Métricas de actividad (nuevos + contactados por período)
  async getActivityMetrics(req, res) {
    try {
      const now = new Date();
      
      // 📅 Calcular inicio y fin de la semana actual (Lunes 00:00 - Domingo 23:59)
      const currentDayOfWeek = now.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
      const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1; // Si es domingo, retroceder 6 días
      
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - daysFromMonday);
      thisWeekStart.setHours(0, 0, 0, 0);
      
      const thisWeekEnd = new Date(thisWeekStart);
      thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
      thisWeekEnd.setHours(23, 59, 59, 999);
      
      // 📅 Calcular inicio y fin de la semana anterior (Lunes 00:00 - Domingo 23:59)
      const prevWeekStart = new Date(thisWeekStart);
      prevWeekStart.setDate(thisWeekStart.getDate() - 7);
      
      const prevWeekEnd = new Date(prevWeekStart);
      prevWeekEnd.setDate(prevWeekStart.getDate() + 6);
      prevWeekEnd.setHours(23, 59, 59, 999);
      
      // 📅 Calcular inicio de período quincenal (hace 2 semanas desde el lunes)
      const biweeklyStart = new Date(thisWeekStart);
      biweeklyStart.setDate(thisWeekStart.getDate() - 14);
      
      // 📅 Calcular inicio de período mensual (hace 30 días)
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Estados que consideramos "contactados" = TODOS excepto 'new'
      // Incluye 'archived' porque significa que se contactó y se archivó (ej: no interesado)
      const CONTACTED_STATUSES = ['contacted', 'interested', 'quoted', 'negotiating', 'won', 'lost', 'archived'];

      const [
        newThisWeek, newPrevWeek, newBiweekly, newMonthly,
        contactedThisWeek, contactedPrevWeek, contactedBiweekly, contactedMonthly,
        noContactCount
      ] = await Promise.all([
        // Nuevos contactos esta semana (Lunes 00:00 hasta ahora)
        SalesLead.count({ where: { createdAt: { [Op.gte]: thisWeekStart } } }),
        // Nuevos contactos semana anterior (Lunes-Domingo pasado)
        SalesLead.count({ where: { createdAt: { [Op.between]: [prevWeekStart, prevWeekEnd] } } }),
        // Nuevos contactos últimas 2 semanas
        SalesLead.count({ where: { createdAt: { [Op.gte]: biweeklyStart } } }),
        // Nuevos contactos último mes
        SalesLead.count({ where: { createdAt: { [Op.gte]: monthAgo } } }),
        
        // 🔄 CONTACTADOS: Cualquier estado que NO sea 'new' = fue contactado
        // Esta semana: leads que PASARON a estado contactado esta semana
        SalesLead.count({ 
          where: { 
            status: { [Op.in]: CONTACTED_STATUSES },
            firstContactDate: { [Op.gte]: thisWeekStart }
          } 
        }),
        // Semana anterior: leads que pasaron a contactado la semana pasada
        SalesLead.count({ 
          where: { 
            status: { [Op.in]: CONTACTED_STATUSES },
            firstContactDate: { [Op.between]: [prevWeekStart, prevWeekEnd] }
          } 
        }),
        // Últimas 2 semanas: leads contactados en las últimas 2 semanas
        SalesLead.count({ 
          where: { 
            status: { [Op.in]: CONTACTED_STATUSES },
            firstContactDate: { [Op.gte]: biweeklyStart }
          } 
        }),
        // Último mes: leads contactados en el último mes
        SalesLead.count({ 
          where: { 
            status: { [Op.in]: CONTACTED_STATUSES },
            firstContactDate: { [Op.gte]: monthAgo }
          } 
        }),
        
        // Sin datos de contacto
        SalesLead.count({
          where: {
            [Op.and]: [
              { [Op.or]: [{ applicantPhone: null }, { applicantPhone: '' }] },
              { [Op.or]: [{ applicantEmail: null }, { applicantEmail: '' }] }
            ]
          }
        })
      ]);

      res.json({
        new: {
          weekly:   { current: newThisWeek,       previous: newPrevWeek },
          biweekly: newBiweekly,
          monthly:  newMonthly
        },
        contacted: {
          weekly:   { current: contactedThisWeek,  previous: contactedPrevWeek },
          biweekly: contactedBiweekly,
          monthly:  contactedMonthly
        },
        noContactCount
      });
    } catch (error) {
      console.error('Error al obtener métricas de actividad:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // �📊 Dashboard de estadísticas
  async getDashboardStats(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const whereClause = {};
      
      if (startDate && endDate) {
        whereClause.createdAt = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      // Stats por estado
      const statsByStatus = await SalesLead.findAll({
        where: whereClause,
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('estimated_value')), 'totalValue']
        ],
        group: ['status'],
        raw: true
      });

      // Stats por prioridad
      const statsByPriority = await SalesLead.findAll({
        where: whereClause,
        attributes: [
          'priority',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['priority'],
        raw: true
      });

      // Stats por fuente
      const statsBySource = await SalesLead.findAll({
        where: whereClause,
        attributes: [
          'source',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['source'],
        raw: true
      });

      // Tasa de conversión
      const totalLeads = await SalesLead.count({ where: whereClause });
      const wonLeads = await SalesLead.count({ 
        where: { ...whereClause, status: 'won' } 
      });
      const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

      res.json({
        statsByStatus,
        statsByPriority,
        statsBySource,
        totals: {
          total: totalLeads,
          won: wonLeads,
          conversionRate: conversionRate.toFixed(2)
        }
      });

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({ 
        error: 'Error al obtener estadísticas',
        details: error.message 
      });
    }
  }
};

module.exports = SalesLeadController;
