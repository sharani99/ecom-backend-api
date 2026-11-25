import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import slugify from 'slugify';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createCategory(dto: CreateCategoryDto) {
    const { parentId } = dto;
    const name = dto.name.trim();

    if (name.length < 2) {
      throw new BadRequestException('Kategori adı en az 2 karakter olmalıdır');
    }

    const slug = slugify(name, {
      lower: true,
      strict: true,
      locale: 'tr',
    });

    if (!slug) {
      throw new BadRequestException('Geçersiz kategori adı');
    }

    const category = await this.prisma.category.findUnique({
      where: {
        slug,
      },
    });

    if (category) {
      throw new ConflictException('Bu kategori zaten mevcut');
    }

    if (parentId != null) {
      const parentCategory = await this.prisma.category.findUnique({
        where: {
          id: parentId,
        },
      });

      if (!parentCategory) {
        throw new NotFoundException('Üst kategori bulunamadı');
      }
    }

    return await this.prisma.category.create({
      data: {
        name,
        slug,
        parentId,
      },
    });
  }

  async findAllCategories() {
    const category = await this.prisma.category.findMany({
      where: {
        parentId: null,
      },
      include: {
        children: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    return category;
  }

  async findOneCategory(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: {
        slug,
      },
      include: {
        children: true,
        parent: true,
      },
    });

    if (!category) {
      throw new NotFoundException('katagori bulunmadı');
    }
    return category;
  }

  async updateCategory(id: number, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Kategori bulunamadı');
    }

    let name = category.name;
    let slug = category.slug;
    let parentId = category.parentId;

    // Kategori adını güncelle
    if (dto.name !== undefined) {
      if (typeof dto.name !== 'string') {
        throw new BadRequestException('Geçersiz kategori adı');
      }

      name = dto.name.trim();

      if (name.length < 2) {
        throw new BadRequestException(
          'Kategori adı en az 2 karakter olmalıdır',
        );
      }

      slug = slugify(name, {
        lower: true,
        strict: true,
        locale: 'tr',
      });

      if (!slug) {
        throw new BadRequestException('Geçersiz kategori adı');
      }
    }

    // Slug benzersizlik kontrolü
    if (slug !== category.slug) {
      const existingCategory = await this.prisma.category.findUnique({
        where: { slug },
      });

      if (existingCategory) {
        throw new ConflictException('Kategori zaten mevcut');
      }
    }

    // Üst kategori kontrolü
    if (dto.parentId !== undefined) {
      parentId = dto.parentId;

      let currentParentId: number | null = parentId;
      const visited = new Set<number>();

      while (currentParentId !== null) {
        if (currentParentId === id || visited.has(currentParentId)) {
          throw new BadRequestException(
            'Döngüsel kategori ilişkisi oluşturulamaz',
          );
        }

        visited.add(currentParentId);

        const parentCategory = await this.prisma.category.findUnique({
          where: { id: currentParentId },
          select: { parentId: true },
        });

        if (!parentCategory) {
          throw new NotFoundException('Üst kategori bulunamadı');
        }

        currentParentId = parentCategory.parentId;
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name,
        slug,
        parentId,
      },
    });
  }

  async deleteCategory(id: number) {
    const category = await this.prisma.category.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            children: true,
            products: true,
          },
        },
      },
    });
    if (!category) {
      throw new NotFoundException('katagori bulunmadı');
    }

    if (category._count.children > 0 || category._count.products > 0) {
      throw new BadRequestException(
        'Alt kategorisi veya bağlı ürünü bulunan kategori silinemez',
      );
    }

    return await this.prisma.category.delete({
      where: {
        id,
      },
    });
  }

  async findSubCategories(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Kategori bulunamadı');
    }

    return this.prisma.category.findMany({
      where: {
        parentId: id,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}
