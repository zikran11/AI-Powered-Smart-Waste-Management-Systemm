'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { gsap } from 'gsap'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getAllPostsFirestore,
  getCategoriesFromPosts,
  getFirestoreErrorMessage,
  getPostByIdFirestore,
  updatePostFirestore,
} from '@/lib/blog-firestore-store'

const defaultCategories = ['Lingkungan', 'Tips & Trick', 'Kreasi', 'Edukasi']

export default function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const pageRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const [categories, setCategories] = useState<string[]>(defaultCategories)
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
  const [coverImagePreview, setCoverImagePreview] = useState('')
  const [authorId, setAuthorId] = useState<string | undefined>()
  const [authorEmail, setAuthorEmail] = useState('')
  const [isLoadingPost, setIsLoadingPost] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    const loadPost = async () => {
      try {
        const [post, posts] = await Promise.all([
          getPostByIdFirestore(resolvedParams.id),
          getAllPostsFirestore(),
        ])

        if (!post) {
          toast.error('Blog tidak ditemukan')
          router.replace('/blog')
          return
        }

        const isAuthor =
          !!user &&
          ((post.authorId && post.authorId === user.uid) ||
            post.author.email === user.email)

        if (!isAuthor) {
          toast.error('Anda tidak memiliki izin untuk mengedit artikel ini')
          router.replace(`/blog/${post.id}`)
          return
        }

        setTitle(post.title)
        setExcerpt(post.excerpt)
        setContent(post.content)
        setCategory(post.category)
        setCoverImage(post.coverImage)
        setCoverImagePreview(post.coverImage)
        setAuthorId(post.authorId)
        setAuthorEmail(post.author.email)
        setCategories(Array.from(new Set([...defaultCategories, ...getCategoriesFromPosts(posts)])))
      } catch (error) {
        toast.error(getFirestoreErrorMessage(error, 'Gagal memuat blog'))
        router.replace('/blog')
      } finally {
        setIsLoadingPost(false)
      }
    }

    if (!authLoading && user) {
      loadPost()
    }
  }, [resolvedParams.id, authLoading, user, router])

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        formRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6 }
      )
    }, pageRef)

    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (!coverImageFile) return

    const objectUrl = URL.createObjectURL(coverImageFile)
    setCoverImagePreview(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [coverImageFile])

  const uploadImageToCloudinary = async (file: File) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    if (!cloudName || !uploadPreset) {
      throw new Error('Cloudinary belum dikonfigurasi')
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', uploadPreset)

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData }
    )

    if (!response.ok) throw new Error('Upload gambar gagal')

    const data = await response.json()
    return data.secure_url as string
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!title || !excerpt || !content || !category) {
      toast.error('Lengkapi semua field')
      return
    }

    if (!user?.uid) {
      toast.error('Sesi login tidak valid')
      return
    }

    const isAuthor =
      (authorId && authorId === user.uid) || (!authorId && authorEmail === user.email)
    if (!isAuthor) {
      toast.error('Anda tidak memiliki izin untuk mengedit artikel ini')
      return
    }

    setIsSubmitting(true)

    try {
      const nextCoverImage = coverImageFile
        ? await uploadImageToCloudinary(coverImageFile)
        : coverImage

      await updatePostFirestore(
        resolvedParams.id,
        { title, excerpt, content, category, coverImage: nextCoverImage },
        user.uid
      )

      toast.success('Blog berhasil diperbarui')
      router.push(`/blog/${resolvedParams.id}`)
      router.refresh()
    } catch (error) {
      toast.error(getFirestoreErrorMessage(error, 'Gagal memperbarui blog'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || isLoadingPost) {
    return <div className="flex justify-center p-10">Loading...</div>
  }

  if (!user) return null

  return (
    <div ref={pageRef} className="min-h-screen py-8">
      <div className="container max-w-3xl mx-auto px-4">
        <Button variant="ghost" onClick={() => router.push(`/blog/${resolvedParams.id}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>

        <Card ref={formRef} className="mt-4">
          <CardHeader>
            <CardTitle>Edit Blog</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                placeholder="Judul Blog"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />

              <Textarea
                placeholder="Deskripsi singkat"
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
              />

              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div>
                <Label>Ganti Gambar Cover</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) setCoverImageFile(file)
                  }}
                />
              </div>

              {coverImagePreview && (
                <div className="w-full h-64 overflow-hidden rounded-lg">
                  <img
                    src={coverImagePreview}
                    alt="Pratinjau cover blog"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <Textarea
                rows={10}
                placeholder="Isi blog..."
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin mr-2" />
                    Menyimpan...
                  </>
                ) : 'Simpan Perubahan'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
