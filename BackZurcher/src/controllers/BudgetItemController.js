const { BudgetItem } = require('../data');
const { uploadBufferToCloudinary } = require('../utils/cloudinaryUploader');

const budgetItemController = {
  // --- CREAR un nuevo BudgetItem ---
  async createBudgetItem(req, res) {
    try {
      const {
        name,
        description,
        category,
        marca,
        capacity,
        unitPrice,
        unit,
        supplierName,
        supplierLocation
      } = req.body;

      // Validación básica de campos requeridos
      if (!name || !category || unitPrice === undefined || unitPrice === null) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: name,  category, unitPrice.' });
      }

      let imageUrl = null;
      // Si se envía archivo (imagen), subir a Cloudinary
      if (req.file && req.file.buffer) {
        try {
          const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
            folder: 'budget_items',
            resource_type: 'image',
          });
          imageUrl = uploadResult.secure_url;
        } catch (err) {
          console.error('Error subiendo imagen a Cloudinary:', err);
          return res.status(500).json({ error: 'Error al subir la imagen.' });
        }
      }

      const newItem = await BudgetItem.create({
        name,
        description,
        category: category ? category.toUpperCase() : category,
        marca,
        capacity,
        unitPrice,
        unit,
        supplierName: supplierName ? supplierName.toUpperCase() : null,
        supplierLocation,
        imageUrl,
        isActive: true
      });

      res.status(201).json(newItem);
    } catch (error) {
      console.error("Error al crear BudgetItem:", error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ error: `El nombre del item '${req.body.name}' ya existe.` });
      }
      res.status(500).json({ error: 'Error interno del servidor al crear el item.' });
    }
  },

  // --- OBTENER todos los BudgetItems (activos por defecto) ---
  async getBudgetItems(req, res) {
    try {
      // Podrías añadir filtros por query params, ej: /budget-items?category=SystemType&active=true
      const { active = 'true', category } = req.query; // Por defecto solo activos
      const whereCondition = {};

      if (active === 'true') {
        whereCondition.isActive = true;
      } else if (active === 'false') {
         whereCondition.isActive = false;
      }
      if (category) {
        whereCondition.category = category;
      }

      const items = await BudgetItem.findAll({ 
        where: whereCondition,
        order: [['category', 'ASC'], ['name', 'ASC']]
      });
      res.status(200).json(items);
    } catch (error) {
      console.error("Error al obtener BudgetItems:", error);
      res.status(500).json({ error: 'Error interno del servidor al obtener los items.' });
    }
  },

   // --- OBTENER BudgetItems por categoría ---
  async getBudgetItemsByCategory(req, res) {
    try {
      const { category } = req.params;
      const { active = 'true' } = req.query;
      
      const whereCondition = { category };
      
      if (active === 'true') {
        whereCondition.isActive = true;
      } else if (active === 'false') {
        whereCondition.isActive = false;
      }

      const items = await BudgetItem.findAll({ 
        where: whereCondition,
        order: [['name', 'ASC']]
      });
      
      res.status(200).json(items);
    } catch (error) {
      console.error("Error al obtener BudgetItems por categoría:", error);
      res.status(500).json({ error: 'Error interno del servidor al obtener los items por categoría.' });
    }
  },

  // --- OBTENER todas las categorías disponibles ---
  async getCategories(req, res) {
    try {
      const categories = await BudgetItem.findAll({
        attributes: ['category'],
        where: { isActive: true },
        group: ['category'],
        order: [['category', 'ASC']]
      });
      
      const categoryNames = categories.map(item => item.category);
      res.status(200).json(categoryNames);
    } catch (error) {
      console.error("Error al obtener categorías:", error);
      res.status(500).json({ error: 'Error interno del servidor al obtener las categorías.' });
    }
  },

  // --- OBTENER un BudgetItem por ID ---
  async getBudgetItemById(req, res) {
    try {
      const { id } = req.params;
      const item = await BudgetItem.findByPk(id);

      if (!item) {
        return res.status(404).json({ error: 'BudgetItem no encontrado.' });
      }

      res.status(200).json(item);
    } catch (error) {
      console.error("Error al obtener BudgetItem por ID:", error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },

  // --- ACTUALIZAR un BudgetItem por ID ---
async updateBudgetItem(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      marca,
      capacity,
      unitPrice,
      unit,
      supplierName,
      supplierLocation
    } = req.body;

    const item = await BudgetItem.findByPk(id);
    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    let imageUrl = item.imageUrl; // Mantener la imagen existente por defecto

    // Si se envía archivo (imagen), subir a Cloudinary
    if (req.file && req.file.buffer) {
      try {
        const uploadResult = await uploadBufferToCloudinary(req.file.buffer, 'budget_items');
        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error('Error al subir imagen:', uploadError);
        return res.status(500).json({ error: 'Error al subir la imagen' });
      }
    }

    const updatedItem = await item.update({
      name: name || item.name,
      description: description || item.description,
      category: category ? category.toUpperCase() : item.category,
      marca: marca || item.marca,
      capacity: capacity || item.capacity,
      unitPrice: unitPrice !== undefined ? unitPrice : item.unitPrice,
      unit: unit || item.unit,
      supplierName: supplierName ? supplierName.toUpperCase() : item.supplierName,
      supplierLocation: supplierLocation || item.supplierLocation,
      imageUrl
    });

    res.json(updatedItem);
  } catch (error) {
    console.error("Error al actualizar BudgetItem:", error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Ya existe un item con ese nombre en esa categoría.' });
    }
    res.status(500).json({ error: 'Error interno del servidor al actualizar el item.' });
  }
},

   // --- SOFT DELETE: Desactivar item ---
  async deactivateBudgetItem(req, res) {
    try {
      const { id } = req.params;
      
      const [updated] = await BudgetItem.update(
        { isActive: false }, 
        { where: { id } }
      );

      if (!updated) {
        return res.status(404).json({ error: 'BudgetItem no encontrado.' });
      }

      const deactivatedItem = await BudgetItem.findByPk(id);
      res.status(200).json({ message: 'Item desactivado exitosamente', item: deactivatedItem });
    } catch (error) {
      console.error("Error al desactivar BudgetItem:", error);
      res.status(500).json({ error: 'Error interno del servidor al desactivar el item.' });
    }
  },

  // --- ACTIVAR item ---
  async activateBudgetItem(req, res) {
    try {
      const { id } = req.params;
      
      const [updated] = await BudgetItem.update(
        { isActive: true }, 
        { where: { id } }
      );

      if (!updated) {
        return res.status(404).json({ error: 'BudgetItem no encontrado.' });
      }

      const activatedItem = await BudgetItem.findByPk(id);
      res.status(200).json({ message: 'Item activado exitosamente', item: activatedItem });
    } catch (error) {
      console.error("Error al activar BudgetItem:", error);
      res.status(500).json({ error: 'Error interno del servidor al activar el item.' });
    }
  },


  // --- ELIMINAR un BudgetItem por ID (Soft Delete recomendado) ---
  async deleteBudgetItem(req, res) {
    try {
      const { id } = req.params;
      
      const deleted = await BudgetItem.destroy({
        where: { id }
      });

      if (!deleted) {
        return res.status(404).json({ error: 'BudgetItem no encontrado para eliminar.' });
      }
      res.status(204).send(); // No content
      

    } catch (error) {
      console.error("Error al eliminar BudgetItem:", error);
      res.status(500).json({ error: 'Error interno del servidor al eliminar el item.' });
    }
  },

  // --- EXPORTAR ITEMS A EXCEL/CSV ---
  async exportItems(req, res) {
    try {
      const { format = 'excel' } = req.query; // excel o csv
      
      const items = await BudgetItem.findAll({
        order: [['category', 'ASC'], ['name', 'ASC']],
        raw: true
      });

      if (format === 'csv') {
        // Generar CSV
        const csvData = [
          // Headers
          ['ID', 'Categoria', 'Nombre', 'Marca', 'Descripcion', 'Capacidad', 'Precio Unitario', 'Proveedor', 'Ubicacion Proveedor', 'Activo', 'URL Imagen'],
          // Data
          ...items.map(item => [
            item.id,
            item.category || '',
            item.name || '',
            item.marca || '',
            item.description || '',
            item.capacity || '',
            item.unitPrice || 0,
            item.supplierName || '',
            item.supplierLocation || '',
            item.isActive ? 'SI' : 'NO',
            item.imageUrl || ''
          ])
        ];

        const csvString = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=budget_items.csv');
        res.send('\uFEFF' + csvString); // BOM para UTF-8

      } else {
        // Generar Excel usando una librería simple
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Budget Items');

        // Headers
        worksheet.columns = [
          { header: 'ID', key: 'id', width: 10 },
          { header: 'Categoria', key: 'category', width: 20 },
          { header: 'Nombre', key: 'name', width: 30 },
          { header: 'Marca', key: 'marca', width: 15 },
          { header: 'Descripcion', key: 'description', width: 40 },
          { header: 'Capacidad', key: 'capacity', width: 15 },
          { header: 'Precio Unitario', key: 'unitPrice', width: 15 },
          { header: 'Proveedor', key: 'supplierName', width: 25 },
          { header: 'Ubicacion Proveedor', key: 'supplierLocation', width: 25 },
          { header: 'Activo', key: 'isActive', width: 10 },
          { header: 'URL Imagen', key: 'imageUrl', width: 50 }
        ];

        // Style headers
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };

        // Add data
        items.forEach(item => {
          worksheet.addRow({
            id: item.id,
            category: item.category || '',
            name: item.name || '',
            marca: item.marca || '',
            description: item.description || '',
            capacity: item.capacity || '',
            unitPrice: item.unitPrice || 0,
            supplierName: item.supplierName || '',
            supplierLocation: item.supplierLocation || '',
            isActive: item.isActive ? 'SI' : 'NO',
            imageUrl: item.imageUrl || ''
          });
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=budget_items.xlsx');

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
      }

    } catch (error) {
      console.error("Error al exportar items:", error);
      res.status(500).json({ error: 'Error al exportar items.' });
    }
  },

  // --- IMPORTAR ITEMS DESDE EXCEL/CSV ---
  async importItems(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó archivo para importar.' });
      }

      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      
      let rows = [];
      
      if (req.file.originalname.toLowerCase().endsWith('.csv')) {
        // Procesar CSV
        const csv = req.file.buffer.toString('utf-8');
        const lines = csv.split('\n');
        rows = lines.slice(1).map(line => {
          const cols = line.split(',').map(col => col.replace(/"/g, '').trim());
          return cols;
        });
      } else {
        // Procesar Excel
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.getWorksheet(1);
        
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) { // Skip header
            const values = row.values.slice(1); // Remove first empty element
            rows.push(values);
          }
        });
      }

      const results = {
        created: [],
        updated: [],
        deleted: [],
        errors: [],
        skipped: []
      };

      // ✅ PASO 1: Recolectar identificadores únicos del Excel (no solo IDs)
      const excelItemKeys = new Set();
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 3) continue;
        
        const [id, category, name, marca, description, capacity, unitPrice, supplierName] = row;
        
        if (name && category) {
          // Crear clave única basada en los campos identificadores
          const key = JSON.stringify({
            category: category?.toString().trim(),
            name: name?.toString().trim(),
            capacity: capacity?.toString().trim() || null,
            description: description?.toString().trim() || null,
            supplierName: supplierName?.toString().trim() || null
          });
          excelItemKeys.add(key);
        }
      }

      // ✅ PASO 2: Eliminar items que NO están en el Excel
      const allExistingItems = await BudgetItem.findAll();
      const itemsToDelete = [];
      
      for (const existingItem of allExistingItems) {
        const existingKey = JSON.stringify({
          category: existingItem.category,
          name: existingItem.name,
          capacity: existingItem.capacity || null,
          description: existingItem.description || null,
          supplierName: existingItem.supplierName || null
        });
        
        if (!excelItemKeys.has(existingKey)) {
          itemsToDelete.push(existingItem.id);
        }
      }
      
      if (itemsToDelete.length > 0) {
        const deletedCount = await BudgetItem.destroy({
          where: { id: itemsToDelete }
        });
        results.deleted.push({ count: deletedCount, message: `${deletedCount} items eliminados (no están en el Excel)` });
        console.log(`🗑️  ${deletedCount} items eliminados (no están en el Excel)`);
      }

      // ✅ PASO 3: Crear o actualizar items del Excel
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 3) continue; // Skip empty rows

        try {
          const [id, category, name, marca, description, capacity, unitPrice, supplierName, supplierLocation, isActive, imageUrl] = row;

          // Validación básica
          if (!name || !category) {
            results.errors.push({ row: i + 2, error: 'Nombre y categoria son requeridos' });
            continue;
          }

          const itemData = {
            category: category?.toString().trim().toUpperCase(),
            name: name?.toString().trim(),
            marca: marca?.toString().trim() || null,
            description: description?.toString().trim() || null,
            capacity: capacity?.toString().trim() || null,
            unitPrice: parseFloat(unitPrice) || 0,
            supplierName: supplierName?.toString().trim().toUpperCase() || null,
            supplierLocation: supplierLocation?.toString().trim() || null,
            isActive: ['SI', 'YES', 'TRUE', '1'].includes(isActive?.toString().toUpperCase()),
            imageUrl: imageUrl?.toString().trim() || null
          };

          // ✅ Buscar item existente por clave compuesta
          const whereClause = {
            category: itemData.category,
            name: itemData.name
          };

          // Agregar campos opcionales a la búsqueda solo si tienen valor
          if (itemData.capacity) whereClause.capacity = itemData.capacity;
          if (itemData.description) whereClause.description = itemData.description;
          if (itemData.supplierName) whereClause.supplierName = itemData.supplierName;

          const existingItem = await BudgetItem.findOne({ where: whereClause });

          if (existingItem) {
            // ✅ ACTUALIZAR item existente
            const oldPrice = existingItem.unitPrice;
            await existingItem.update(itemData);
            results.updated.push({ 
              id: existingItem.id, 
              name: itemData.name, 
              category: itemData.category,
              oldPrice: oldPrice,
              newPrice: itemData.unitPrice 
            });
            console.log(`🔄 Actualizado: ${itemData.category} - ${itemData.name} (${itemData.supplierName || 'N/A'}) | $${oldPrice} → $${itemData.unitPrice}`);
          } else {
            // ✅ CREAR nuevo item
            const newItem = await BudgetItem.create(itemData);
            results.created.push({ 
              id: newItem.id, 
              name: itemData.name, 
              category: itemData.category,
              price: itemData.unitPrice 
            });
            console.log(`✨ Creado: ${itemData.category} - ${itemData.name} (${itemData.supplierName || 'N/A'}) | $${itemData.unitPrice}`);
          }

        } catch (error) {
          results.errors.push({ row: i + 2, error: error.message });
        }
      }

      res.json({
        message: 'Importación completada exitosamente',
        results,
        summary: {
          created: results.created.length,
          updated: results.updated.length,
          deleted: results.deleted.length,
          errors: results.errors.length,
          skipped: results.skipped.length,
          total: results.created.length + results.updated.length
        }
      });

    } catch (error) {
      console.error("Error al importar items:", error);
      res.status(500).json({ error: 'Error al procesar el archivo de importación.' });
    }
  },

  // --- GENERAR TEMPLATE DE IMPORTACIÓN ---
  async generateTemplate(req, res) {
    try {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Template Budget Items');

      // Headers
      worksheet.columns = [
        { header: 'ID (dejar vacío para crear nuevo)', key: 'id', width: 30 },
        { header: 'Categoria *', key: 'category', width: 20 },
        { header: 'Nombre *', key: 'name', width: 30 },
        { header: 'Marca', key: 'marca', width: 15 },
        { header: 'Descripcion', key: 'description', width: 40 },
        { header: 'Capacidad', key: 'capacity', width: 15 },
        { header: 'Precio Unitario *', key: 'unitPrice', width: 15 },
        { header: 'Proveedor', key: 'supplierName', width: 25 },
        { header: 'Ubicacion Proveedor', key: 'supplierLocation', width: 25 },
        { header: 'Activo (SI/NO)', key: 'isActive', width: 15 },
        { header: 'URL Imagen', key: 'imageUrl', width: 50 }
      ];

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      worksheet.getRow(1).font.color = { argb: 'FFFFFFFF' };

      // Add example rows
      worksheet.addRow({
        id: '',
        category: 'System Type',
        name: 'ATU Example',
        marca: 'Fuji',
        description: 'Aerobic Treatment Unit example',
        capacity: '300 GPD',
        unitPrice: 1500.00,
        supplierName: 'Example Supplier',
        supplierLocation: 'Florida',
        isActive: 'SI',
        imageUrl: ''
      });

      worksheet.addRow({
        id: '',
        category: 'Labor',
        name: 'Installation Labor',
        marca: '',
        description: 'Professional installation service',
        capacity: '',
        unitPrice: 200.00,
        supplierName: 'Local Contractor',
        supplierLocation: 'Miami',
        isActive: 'SI',
        imageUrl: ''
      });

      // Add instructions
      const instructionRow = worksheet.addRow([]);
      instructionRow.getCell(1).value = 'INSTRUCCIONES:';
      instructionRow.getCell(1).font = { bold: true, color: { argb: 'FFFF0000' } };

      worksheet.addRow(['- Los campos marcados con * son obligatorios']);
      worksheet.addRow(['- Deje el ID vacío para crear nuevos items']);
      worksheet.addRow(['- Use el ID existente para actualizar items']);
      worksheet.addRow(['- Para Activo use: SI/NO, YES/NO, TRUE/FALSE, 1/0']);
      worksheet.addRow(['- Descargue este template, editelo y luego súbalo']);

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=budget_items_template.xlsx');

      // Write to response
      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error("Error al generar template:", error);
      res.status(500).json({ error: 'Error al generar template.' });
    }
  }
};

module.exports = budgetItemController;